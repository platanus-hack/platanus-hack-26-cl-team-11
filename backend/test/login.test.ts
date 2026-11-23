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
  const sessionOf = (token: string) => ({ cookie: `montu_sesion=${encodeURIComponent(ctx.vault.seal(JSON.stringify({ token })))}` });
  const loginOf = async (token: string) => ((await (await app.request(`/api/people/${token}`, { headers: sessionOf(token) })).json()) as { name: string; login: { email: string | null; name: string | null; available: boolean } });
  return { ctx, app, through, loginOf, sessionOf, signInAs: (email: string, name: string) => (account = { email, name }) };
}

test('entering with Google creates your page the first time and brings you back to the same one afterwards', async () => {
  const { app, through, loginOf } = setup();
  assert.deepEqual(await (await app.request('/api/login')).json(), { google: true });

  const started = await app.request('/api/login/google/start');
  const authorize = new URL(started.headers.get('location') ?? '');
  assert.equal(`${authorize.origin}${authorize.pathname}`, 'https://accounts.google.com/o/oauth2/v2/auth');
  assert.equal(authorize.searchParams.get('scope'), 'openid email profile');
  assert.equal(authorize.searchParams.get('prompt'), 'select_account');
  assert.equal(authorize.searchParams.get('access_type'), null);
  assert.equal(authorize.searchParams.get('redirect_uri'), 'https://ronda.test/api/oauth/google/callback');

  const first = await through('/api/login/google/start');
  assert.equal(first.status, 302);
  const page = first.headers.get('location') ?? '';
  assert.match(page, /^\/conectar\/[A-Za-z0-9_-]+$/);
  const token = page.split('/').at(-1) ?? '';
  assert.deepEqual(await loginOf(token), { ...(await loginOf(token)), name: 'Ian Fry', login: { email: 'ian@vita.lat', name: 'Ian Fry', available: true } });

  const again = await through('/api/login/google/start');
  assert.equal(again.headers.get('location'), page);
});

test('a page that already exists is associated with a Google account, also when a login had already opened an empty page', async () => {
  const { ctx, through, loginOf, signInAs } = setup();
  const ana = ctx.store.addPerson('Ana papita');
  const tomas = ctx.store.addPerson('Tomás');
  ctx.teams.addMember(ctx.teams.createTeam('Vita').id, ana.token);
  signInAs('ana@vita.lat', 'Ana Pérez');

  const fresh = await through('/api/login/google/start');
  const emptyPage = fresh.headers.get('location') ?? '';
  assert.notEqual(emptyPage, `/conectar/${ana.token}`);

  const linked = await through(`/api/people/${ana.token}/login/google/start`);
  assert.equal(linked.headers.get('location'), `/conectar/${ana.token}#ajustes`);
  assert.deepEqual((await loginOf(ana.token)).login, { email: 'ana@vita.lat', name: 'Ana Pérez', available: true });
  assert.equal((await loginOf(ana.token)).name, 'Ana papita');

  const back = await through('/api/login/google/start');
  assert.equal(back.headers.get('location'), `/conectar/${ana.token}`);

  const taken = await through(`/api/people/${tomas.token}/login/google/start`);
  assert.match(decodeURIComponent(taken.headers.get('location') ?? ''), /ya abre otra página tuya de Montu que tiene datos/);
  assert.equal((await loginOf(tomas.token)).login.email, null);
});

test('entering with Google finds the page whose integrations already use that account, instead of opening a new one', async () => {
  const { ctx, through, signInAs } = setup();
  const ian = ctx.store.addPerson('Ian papita');
  ctx.store.saveConnection(ian.token, 'granola', 'IAN@vita.lat', 'secreto');
  ctx.store.saveEvent(ian.token, { source: 'apple_health', type: 'salud_diaria', occurredAt: '2026-11-21', summary: 'sueño 7.0 h', raw: {}, externalId: 'dia:2026-11-21' });
  signInAs('ian@vita.lat', 'Ian Fry');

  const first = await through('/api/login/google/start');
  assert.equal(first.headers.get('location'), `/conectar/${ian.token}`);
  assert.equal(ctx.store.findPerson(ian.token)?.name, 'Ian papita');
});

test('the session stays open on the device until the person closes it', async () => {
  const { app, through } = setup();
  const entered = await through('/api/login/google/start');
  const token = (entered.headers.get('location') ?? '').split('/').at(-1) ?? '';
  const cookie = (entered.headers.get('set-cookie') ?? '').split(',').map((part) => part.trim().split(';')[0] ?? '').find((part) => part.startsWith('montu_sesion=')) ?? '';
  assert.ok(cookie.length > 'montu_sesion='.length);
  assert.match(entered.headers.get('set-cookie') ?? '', /Max-Age=5184000/);

  assert.deepEqual(await (await app.request('/api/session', { headers: { cookie } })).json(), { person: { token, name: 'Ian Fry' } });
  assert.deepEqual(await (await app.request('/api/session')).json(), { person: null });
  assert.deepEqual(await (await app.request('/api/session', { headers: { cookie: 'montu_sesion=falsa' } })).json(), { person: null });

  const closed = await app.request('/api/session/logout', { method: 'POST', headers: { cookie } });
  assert.match(closed.headers.get('set-cookie') ?? '', /montu_sesion=;/);
});

test('without Google configured there is no login to offer', async () => {
  const { app, through } = setup({ config: { publicBaseUrl: 'https://ronda.test', oauth: {} } });
  assert.deepEqual(await (await app.request('/api/login')).json(), { google: false });
  assert.equal((await through('/api/login/google/start')).status, 500);
});

test('una página con cuenta de Google solo se abre con esa sesión; el link solo ya no alcanza', async () => {
  const { ctx, app, through, sessionOf } = setup();
  const entered = await through('/api/login/google/start');
  const token = (entered.headers.get('location') ?? '').split('/').at(-1) ?? '';
  const other = ctx.store.addPerson('Sin cuenta');

  for (const path of [`/api/people/${token}`, `/api/people/${token}/signals`, `/api/people/${token}/events`, `/api/context/${token}`]) {
    const refused = await app.request(path);
    assert.equal(refused.status, 401);
    assert.deepEqual(await refused.json(), { error: 'Esta página tiene cuenta de Google. Entra con Google para abrirla.', signIn: 'google' });
    assert.equal((await app.request(path, { headers: sessionOf(other.token) })).status, 401);
    assert.equal((await app.request(path, { headers: { cookie: 'montu_sesion=falsa' } })).status, 401);
    assert.equal((await app.request(path, { headers: sessionOf(token) })).status, 200);
  }

  const change = { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Otro nombre' }) };
  assert.equal((await app.request(`/api/people/${token}/profile`, change)).status, 401);
  const join = (headers: Record<string, string>) => app.request('/api/rooms', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify({ name: 'Sala', token }) });
  assert.equal((await join({})).status, 401);
  assert.equal((await join(sessionOf(token))).status, 201);
});

test('una página sin cuenta de Google sigue abriendo con su link, y los datos de salud entran sin sesión', async () => {
  const { ctx, app, through } = setup();
  const plain = ctx.store.addPerson('Sin cuenta');
  assert.equal((await app.request(`/api/people/${plain.token}`)).status, 200);
  const entered = await through('/api/login/google/start');
  const token = (entered.headers.get('location') ?? '').split('/').at(-1) ?? '';
  const delivery = await app.request(`/api/ingest/health/${token}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ date: '2026-11-21', steps: 1200 }) });
  assert.equal(delivery.status, 201);
});

test('sin Google configurado en el servidor nadie queda afuera de su página', async () => {
  const { ctx, app } = setup({ config: { publicBaseUrl: 'https://ronda.test', oauth: {} } });
  const person = ctx.store.addPerson('Ian');
  ctx.db.prepare('INSERT INTO logins (email, person_token, linked_at, name) VALUES (?, ?, ?, ?)').run('ian@vita.lat', person.token, new Date().toISOString(), 'Ian');
  assert.equal((await app.request(`/api/people/${person.token}`)).status, 200);
});

test('with a list of domains, only those accounts get in and nobody else gets a page', async () => {
  const { ctx, through, signInAs } = setup({ config: { ...config, loginDomains: ['vita.lat'] } });
  const inside = await through('/api/login/google/start');
  assert.match(inside.headers.get('location') ?? '', /^\/conectar\//);
  const people = ctx.store.listPeople().length;

  signInAs('alguien@gmail.com', 'Alguien');
  const outside = await through('/api/login/google/start');
  assert.equal(outside.status, 302);
  assert.equal(outside.headers.get('location'), `/?aviso=${encodeURIComponent('Este Montu es solo para las cuentas de su equipo. Entra con tu correo de trabajo.')}`);
  assert.ok(!(outside.headers.get('set-cookie') ?? '').includes('montu_sesion'));
  assert.equal(ctx.store.listPeople().length, people);
});
