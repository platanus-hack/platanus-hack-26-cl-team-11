import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { createContext, type Config } from '../src/context.js';
import type { Fetch } from '../src/types.js';

const OWN_PAGE = { 'sec-fetch-site': 'same-origin' };
const config: Config = { publicBaseUrl: 'https://ronda.test', oauth: { google: { clientId: 'g-id', clientSecret: 'g-secret' } } };

function setup(options: { config?: Config } = {}) {
  let account = { email: 'Ian@Vita.lat', name: 'Ian Fry' };
  const fakeGoogle = (async (input: Parameters<Fetch>[0]) => {
    const url = String(input);
    if (url === 'https://oauth2.googleapis.com/token') return Response.json({ access_token: 'acceso', expires_in: 3600 });
    if (url === 'https://www.googleapis.com/oauth2/v3/userinfo') return Response.json(account);
    return new Response('{}', { status: 404 });
  }) as Fetch;
  const ctx = createContext({ location: ':memory:', model: null, whatsapp: null, fetch: fakeGoogle, config: options.config ?? config });
  const app = createApp(ctx);
  const through = async (startPath: string) => {
    const started = await app.request(startPath, { headers: OWN_PAGE });
    if (started.status !== 302) return started;
    const location = new URL(started.headers.get('location') ?? '');
    const cookie = (started.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
    return app.request(`/api/oauth/google/callback?${new URLSearchParams({ code: 'codigo', state: location.searchParams.get('state') ?? '' })}`, { headers: { cookie } });
  };
  const loginOf = async (token: string) => ((await (await app.request(`/api/people/${token}`)).json()) as { name: string; login: { email: string | null; available: boolean } });
  return { ctx, app, through, loginOf, signInAs: (email: string, name: string) => (account = { email, name }) };
}

test('entering with Google creates your page the first time and brings you back to the same one afterwards', async () => {
  const { app, through, loginOf } = setup();
  assert.deepEqual(await (await app.request('/api/login')).json(), { google: true });

  const started = await app.request('/api/login/google/start');
  const authorize = new URL(started.headers.get('location') ?? '');
  assert.equal(`${authorize.origin}${authorize.pathname}`, 'https://accounts.google.com/o/oauth2/v2/auth');
  assert.equal(authorize.searchParams.get('scope'), 'openid email profile');
  assert.equal(authorize.searchParams.get('redirect_uri'), 'https://ronda.test/api/oauth/google/callback');

  const first = await through('/api/login/google/start');
  assert.equal(first.status, 302);
  const page = first.headers.get('location') ?? '';
  assert.match(page, /^\/conectar\/[A-Za-z0-9_-]+$/);
  const token = page.split('/').at(-1) ?? '';
  assert.deepEqual(await loginOf(token), { ...(await loginOf(token)), name: 'Ian Fry', login: { email: 'ian@vita.lat', available: true } });

  const again = await through('/api/login/google/start');
  assert.equal(again.headers.get('location'), page);
});

test('a page that already exists is associated with a Google account, and one account never opens two pages', async () => {
  const { ctx, through, loginOf, signInAs } = setup();
  const ana = ctx.store.addPerson('Ana');
  const tomas = ctx.store.addPerson('Tomás');
  signInAs('ana@vita.lat', 'Ana Pérez');

  const linked = await through(`/api/people/${ana.token}/login/google/start`);
  assert.equal(linked.headers.get('location'), `/conectar/${ana.token}#ajustes`);
  assert.equal((await loginOf(ana.token)).login.email, 'ana@vita.lat');
  assert.equal((await loginOf(ana.token)).name, 'Ana');

  const taken = await through(`/api/people/${tomas.token}/login/google/start`);
  assert.match(decodeURIComponent(taken.headers.get('location') ?? ''), /ya está asociada a otra página de Ronda/);
  assert.equal((await loginOf(tomas.token)).login.email, null);

  const back = await through('/api/login/google/start');
  assert.equal(back.headers.get('location'), `/conectar/${ana.token}`);
});

test('without Google configured there is no login to offer', async () => {
  const { app, through } = setup({ config: { publicBaseUrl: 'https://ronda.test', oauth: {} } });
  assert.deepEqual(await (await app.request('/api/login')).json(), { google: false });
  assert.equal((await through('/api/login/google/start')).status, 500);
});
