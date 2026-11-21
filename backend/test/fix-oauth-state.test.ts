import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { createContext, type Config } from '../src/context.js';
import type { Fetch } from '../src/types.js';

const config: Config = { publicBaseUrl: 'https://ronda.test', oauth: { google: { clientId: 'id', clientSecret: 'secret' } } };
const INVALID_STATE = { error: 'El enlace de conexión venció o no es válido. Vuelve a intentarlo desde tu página.' };
const OWN_PAGE = { 'sec-fetch-site': 'same-origin' };
const VICTIM_SUBJECT = 'ASUNTO-PRIVADO-DE-LA-VICTIMA';

const googleFetch: Fetch = (async (input: Parameters<Fetch>[0]) => {
  const url = String(input);
  if (url.startsWith('https://oauth2.googleapis.com/token')) return Response.json({ access_token: 'victim-access', refresh_token: 'victim-refresh', expires_in: 3600 });
  if (url.startsWith('https://www.googleapis.com/oauth2/v3/userinfo')) return Response.json({ email: 'victima@example.com' });
  if (url.startsWith('https://www.googleapis.com/calendar/v3/')) return Response.json({ items: [] });
  if (url.startsWith('https://gmail.googleapis.com/gmail/v1/users/me/messages/m_1')) {
    return Response.json({ id: 'm_1', internalDate: String(Date.now() - 60_000), payload: { headers: [{ name: 'Subject', value: VICTIM_SUBJECT }, { name: 'From', value: 'jefa@example.com' }] } });
  }
  if (url.startsWith('https://gmail.googleapis.com/gmail/v1/users/me/messages')) return Response.json({ messages: [{ id: 'm_1' }] });
  return new Response('{}', { status: 404 });
}) as Fetch;

const setup = (options: { config?: Config } = {}) => {
  const ctx = createContext({ location: ':memory:', fetch: googleFetch, config: options.config ?? config });
  const app = createApp(ctx);
  const { token } = ctx.store.addPerson('Ana');
  const start = (headers: Record<string, string> = OWN_PAGE, origin = '') => app.request(`${origin}/api/people/${token}/oauth/google/start`, { headers });
  const begin = async () => {
    const response = await start();
    assert.equal(response.status, 302);
    const state = new URL(response.headers.get('location') ?? '').searchParams.get('state') ?? '';
    const cookie = (response.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
    assert.ok(state && cookie.startsWith('ronda_oauth_google='));
    return { state, cookie };
  };
  const callback = (query: Record<string, string>, cookie?: string) =>
    app.request(`/api/oauth/google/callback?${new URLSearchParams(query)}`, cookie ? { headers: { cookie } } : undefined);
  return { ctx, app, token, start, begin, callback };
};

test('a consent given in another browser is not attached to the person who started the flow', async () => {
  const { ctx, app, token, begin, callback } = setup();
  const { state } = await begin();

  const response = await callback({ code: 'victim-code', state });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), INVALID_STATE);
  assert.equal(response.headers.get('location'), null);
  assert.deepEqual(ctx.store.listConnections(token), []);

  const events = await (await app.request(`/api/people/${token}/events`)).text();
  assert.ok(!events.includes(VICTIM_SUBJECT));
});

test('the browser that started the flow connects once and the same state cannot be replayed', async () => {
  const { ctx, token, begin, callback } = setup();
  const { state, cookie } = await begin();

  const connected = await callback({ code: 'code-1', state }, cookie);
  assert.equal(connected.status, 302);
  assert.equal(connected.headers.get('location'), `/conectar/${token}`);
  assert.deepEqual(ctx.store.listConnections(token).map((connection) => connection.source).sort(), ['gmail', 'google_calendar']);
  const cleared = connected.headers.get('set-cookie') ?? '';
  assert.ok(cleared.startsWith('ronda_oauth_google=;'));
  assert.ok(cleared.includes('Max-Age=0'));

  const replay = await callback({ code: 'code-2', state }, cookie);
  assert.equal(replay.status, 400);
  assert.deepEqual(await replay.json(), INVALID_STATE);
});

test('a cookie from a different start does not match the state', async () => {
  const { ctx, token, begin, callback } = setup();
  const first = await begin();
  const second = await begin();
  assert.notEqual(first.cookie, second.cookie);

  const response = await callback({ code: 'code-1', state: first.state }, second.cookie);
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), INVALID_STATE);
  assert.deepEqual(ctx.store.listConnections(token), []);
});

test('a denied consent without the cookie does not reveal the link of the person', async () => {
  const { token, begin, callback } = setup();
  const { state, cookie } = await begin();

  const leaked = await callback({ error: 'access_denied', state });
  assert.equal(leaked.status, 400);
  assert.equal(leaked.headers.get('location'), null);
  assert.ok(!(await leaked.text()).includes(token));

  const own = await callback({ error: 'access_denied', state }, cookie);
  assert.equal(own.status, 302);
  assert.equal(own.headers.get('location'), `/conectar/${token}`);
});

test('start only answers a navigation that comes from the own page', async () => {
  const { start } = setup();
  const foreign: Array<Record<string, string>> = [{}, { 'sec-fetch-site': 'cross-site' }, { 'sec-fetch-site': 'none' }, { 'sec-fetch-site': 'same-site' }, { referer: 'https://otro.example/pagina' }];
  for (const headers of foreign) {
    const response = await start(headers);
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: 'Abre la conexión desde tu página de Montu.' });
    assert.equal(response.headers.get('set-cookie'), null);
    assert.equal(response.headers.get('location'), null);
  }
  assert.equal((await start({ 'sec-fetch-site': 'cross-site', referer: 'https://ronda.test/conectar/x' })).status, 403);
  assert.equal((await start({ referer: 'https://ronda.test/conectar/x' })).status, 302);
});

test('the cookie is bound to the callback path, hidden from scripts and secure on https', async () => {
  const secure = await setup().start();
  const attributes = (secure.headers.get('set-cookie') ?? '').split('; ');
  for (const attribute of ['Max-Age=600', 'Path=/api/oauth/google/callback', 'HttpOnly', 'Secure', 'SameSite=Lax']) assert.ok(attributes.includes(attribute), attribute);

  const local = await setup({ config: { ...config, publicBaseUrl: null } }).start(OWN_PAGE, 'http://localhost:8787');
  assert.equal(local.status, 302);
  assert.ok(!(local.headers.get('set-cookie') ?? '').split('; ').includes('Secure'));
});
