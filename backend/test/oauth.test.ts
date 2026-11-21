import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Hono } from 'hono';
import { gmail } from '../src/connectors/gmail.js';
import { googleCalendar } from '../src/connectors/googleCalendar.js';
import { CONNECTORS } from '../src/connectors/registry.js';
import { createContext, type Config } from '../src/context.js';
import { createVault } from '../src/crypto.js';
import { google } from '../src/oauth/google.js';
import { OAUTH_PROVIDERS } from '../src/oauth/registry.js';
import { oauthRoutes } from '../src/routes/oauth.js';
import { syncSource } from '../src/sync.js';
import { ConnectorError, type Fetch, type OAuthConnector, type OAuthTokens } from '../src/types.js';

const registeredConnectors = [...CONNECTORS];
const registeredGoogle = OAUTH_PROVIDERS.google;

for (const connector of [googleCalendar, gmail] satisfies OAuthConnector[]) {
  const position = CONNECTORS.findIndex((item) => item.id === connector.id);
  if (position === -1) CONNECTORS.push(connector);
  else CONNECTORS[position] = connector;
}
OAUTH_PROVIDERS.google = google;

after(() => {
  CONNECTORS.splice(0, CONNECTORS.length, ...registeredConnectors);
  if (registeredGoogle) OAUTH_PROVIDERS.google = registeredGoogle;
  else delete OAUTH_PROVIDERS.google;
});

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.metadata';
const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

const config: Config = { publicBaseUrl: 'https://ronda.test', oauth: { google: { clientId: 'id', clientSecret: 'secret' } } };
const NONCE = 'nonce-de-prueba';
const NONCE_HASH = createHash('sha256').update(NONCE).digest('hex');
const OWN_PAGE = { headers: { 'sec-fetch-site': 'same-origin' } };

const at = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();
const meetingStart = at(-2 * 60 * MINUTE_MS);
const recentMail = Date.now() - 3 * 60 * MINUTE_MS;
const oldMail = Date.now() - 60 * DAY_MS;

interface Call {
  url: string;
  method: string;
  authorization: string;
  form: URLSearchParams;
}

type Routes = Record<string, (call: Call) => Response>;

const fakeFetch = (routes: Routes, calls: Call[] = []): Fetch =>
  (async (input: Parameters<Fetch>[0], init?: Parameters<Fetch>[1]) => {
    const call: Call = {
      url: String(input),
      method: init?.method ?? 'GET',
      authorization: new Headers(init?.headers).get('authorization') ?? '',
      form: new URLSearchParams(typeof init?.body === 'string' ? init.body : ''),
    };
    calls.push(call);
    const match = Object.keys(routes).find((prefix) => call.url.startsWith(prefix));
    return match ? routes[match]!(call) : new Response('{}', { status: 404 });
  }) as Fetch;

const calendarEvents = {
  items: [
    {
      id: 'ev_planning',
      status: 'confirmed',
      summary: 'Planificación',
      description: 'AGENDA-PRIVADA',
      start: { dateTime: meetingStart },
      end: { dateTime: new Date(new Date(meetingStart).getTime() + 45 * MINUTE_MS).toISOString() },
      attendees: [
        { email: 'ana@example.com', self: true, responseStatus: 'accepted' },
        { email: 'tomas@example.com', responseStatus: 'accepted' },
        { email: 'lu@example.com', responseStatus: 'needsAction' },
        { email: 'sala@resource.calendar.google.com', resource: true, responseStatus: 'accepted' },
      ],
    },
    {
      id: 'ev_declined',
      status: 'confirmed',
      summary: 'Comité',
      start: { dateTime: at(-5 * 60 * MINUTE_MS) },
      end: { dateTime: at(-4 * 60 * MINUTE_MS) },
      attendees: [
        { email: 'ana@example.com', self: true, responseStatus: 'declined' },
        { email: 'tomas@example.com', responseStatus: 'accepted' },
      ],
    },
    { id: 'ev_all_day', status: 'confirmed', summary: 'Feriado', start: { date: '2026-11-20' }, end: { date: '2026-11-21' } },
    { id: 'ev_cancelled', status: 'cancelled', summary: 'Demo', start: { dateTime: at(-DAY_MS) }, end: { dateTime: at(-DAY_MS + 30 * MINUTE_MS) } },
    { id: 'ev_focus', status: 'confirmed', summary: 'Bloque de foco', start: { dateTime: at(DAY_MS) }, end: { dateTime: at(DAY_MS + 90 * MINUTE_MS) } },
  ],
};

const mail = (id: string, internalDate: number, headers: Record<string, string>, labelIds: string[] = ['INBOX']) => ({
  id,
  threadId: `thread_${id}`,
  labelIds,
  internalDate: String(internalDate),
  snippet: `SNIPPET-PRIVADO ${id}`,
  payload: {
    headers: Object.entries(headers).map(([name, value]) => ({ name, value })),
    body: { data: 'CUERPO-PRIVADO' },
  },
});

const googleRoutes = (overrides: Routes = {}): Routes => ({
  'https://oauth2.googleapis.com/token': (call) =>
    call.form.get('grant_type') === 'refresh_token'
      ? Response.json({ access_token: 'access-renewed', expires_in: 3600, token_type: 'Bearer' })
      : Response.json({ access_token: 'access-1', refresh_token: 'refresh-1', expires_in: 3600, token_type: 'Bearer' }),
  'https://www.googleapis.com/oauth2/v3/userinfo': () => Response.json({ sub: '1', email: 'ana@example.com', email_verified: true }),
  'https://www.googleapis.com/calendar/v3/calendars/primary/events': () => Response.json(calendarEvents),
  'https://gmail.googleapis.com/gmail/v1/users/me/messages/m_budget': () =>
    Response.json(mail('m_budget', recentMail, { Subject: 'Presupuesto Q1', From: 'Tomás Pérez <tomas@example.com>', Date: 'Sat, 21 Nov 2026 10:00:00 -0300' })),
  'https://gmail.googleapis.com/gmail/v1/users/me/messages/m_bank': () => Response.json(mail('m_bank', recentMail, { from: 'avisos@banco.cl' })),
  'https://gmail.googleapis.com/gmail/v1/users/me/messages/m_old': () => Response.json(mail('m_old', oldMail, { Subject: 'Viejo', From: 'x@example.com' })),
  'https://gmail.googleapis.com/gmail/v1/users/me/messages/m_draft': () =>
    Response.json(mail('m_draft', recentMail, { Subject: 'Borrador', From: 'ana@example.com' }, ['DRAFT'])),
  'https://gmail.googleapis.com/gmail/v1/users/me/messages': () =>
    Response.json({ messages: [{ id: 'm_budget' }, { id: 'm_bank' }, { id: 'm_old' }, { id: 'm_draft' }], resultSizeEstimate: 4 }),
  ...overrides,
});

const setup = (routes: Routes = googleRoutes(), options: { config?: Config } = {}) => {
  const calls: Call[] = [];
  const ctx = createContext({ location: ':memory:', fetch: fakeFetch(routes, calls), config: options.config ?? config });
  const app = new Hono().route('/api', oauthRoutes(ctx));
  const { token } = ctx.store.addPerson('Ana');
  const stateFor = (overrides: Record<string, unknown> = {}) => ctx.vault.seal(JSON.stringify({ token, provider: 'google', at: Date.now(), nonce: NONCE_HASH, ...overrides }));
  const callback = (query: Record<string, string>) =>
    app.request(`/api/oauth/google/callback?${new URLSearchParams(query)}`, { headers: { cookie: `ronda_oauth_google=${NONCE}` } });
  return { ctx, store: ctx.store, app, token, calls, stateFor, callback };
};

test('start redirects to Google with the client, scopes, redirect uri and a sealed state', async () => {
  const { ctx, app, token } = setup();
  const response = await app.request(`/api/people/${token}/oauth/google/start`, OWN_PAGE);
  assert.equal(response.status, 302);

  const location = new URL(response.headers.get('location') ?? '');
  assert.equal(`${location.origin}${location.pathname}`, 'https://accounts.google.com/o/oauth2/v2/auth');
  assert.equal(location.searchParams.get('client_id'), 'id');
  assert.equal(location.searchParams.get('redirect_uri'), 'https://ronda.test/api/oauth/google/callback');
  assert.equal(location.searchParams.get('response_type'), 'code');
  assert.equal(location.searchParams.get('access_type'), 'offline');
  assert.equal(location.searchParams.get('prompt'), 'consent');
  assert.equal(location.searchParams.get('include_granted_scopes'), 'true');
  assert.deepEqual((location.searchParams.get('scope') ?? '').split(' ').sort(), [CALENDAR_SCOPE, GMAIL_SCOPE, 'email', 'openid'].sort());
  assert.ok(!location.search.includes('secret'));

  const state = JSON.parse(ctx.vault.open(location.searchParams.get('state') ?? '')) as { token: string; provider: string; at: number; nonce: string };
  const cookie = (response.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
  assert.equal(state.nonce, createHash('sha256').update(cookie.slice('ronda_oauth_google='.length)).digest('hex'));
  assert.equal(state.token, token);
  assert.equal(state.provider, 'google');
  assert.ok(Math.abs(Date.now() - state.at) < MINUTE_MS);
});

test('start falls back to the request origin when there is no public base url', async () => {
  const { app, token } = setup(googleRoutes(), { config: { ...config, publicBaseUrl: null } });
  const response = await app.request(`http://localhost:8787/api/people/${token}/oauth/google/start`, OWN_PAGE);
  assert.equal(new URL(response.headers.get('location') ?? '').searchParams.get('redirect_uri'), 'http://localhost:8787/api/oauth/google/callback');
});

test('start refuses an unknown person, an unknown provider and a provider without credentials', async () => {
  const { app, token } = setup();
  const unknownPerson = await app.request('/api/people/nadie/oauth/google/start', OWN_PAGE);
  assert.equal(unknownPerson.status, 404);
  assert.deepEqual(await unknownPerson.json(), { error: 'Link no válido.' });
  assert.equal((await app.request(`/api/people/${token}/oauth/otro/start`, OWN_PAGE)).status, 400);
  assert.equal((await app.request(`/api/people/${token}/oauth/constructor/start`, OWN_PAGE)).status, 400);

  const unconfigured = setup(googleRoutes(), { config: { publicBaseUrl: null, oauth: {} } });
  const response = await unconfigured.app.request(`/api/people/${unconfigured.token}/oauth/google/start`, OWN_PAGE);
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: 'Falta configurar google en el servidor: define GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET.' });
});

test('a forged, foreign, mismatched or expired state is rejected before talking to Google', async () => {
  const { store, token, calls, stateFor, callback } = setup();
  const foreignVault = createVault(null);
  const rejected = [
    'forjado',
    '',
    foreignVault.seal(JSON.stringify({ token, provider: 'google', at: Date.now() })),
    stateFor({ provider: 'otro' }),
    stateFor({ at: Date.now() - 11 * MINUTE_MS }),
  ];
  for (const state of rejected) {
    const response = await callback({ code: 'code-1', state });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'El enlace de conexión venció o no es válido. Vuelve a intentarlo desde tu página.' });
  }
  assert.equal((await callback({ code: 'code-1' })).status, 400);
  assert.equal(calls.length, 0);
  assert.equal(store.listConnections(token).length, 0);
});

test('a state for a person that no longer exists is refused', async () => {
  const { stateFor, callback, calls } = setup();
  assert.equal((await callback({ code: 'code-1', state: stateFor({ token: 'nadie' }) })).status, 404);
  assert.equal(calls.length, 0);
});

test('denied consent goes back to the person page without saving anything', async () => {
  const { store, token, calls, stateFor, callback } = setup();
  const response = await callback({ error: 'access_denied', state: stateFor() });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), `/conectar/${token}`);
  assert.equal(calls.length, 0);
  assert.equal(store.listConnections(token).length, 0);
});

test('a successful callback connects every Google source and imports meetings and mail', async () => {
  const { store, token, calls, stateFor, callback } = setup();
  const response = await callback({ code: 'code-1', state: stateFor() });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), `/conectar/${token}`);

  const exchange = calls.find((call) => call.url === 'https://oauth2.googleapis.com/token');
  assert.equal(exchange?.method, 'POST');
  assert.deepEqual(Object.fromEntries(exchange?.form ?? []), {
    grant_type: 'authorization_code',
    code: 'code-1',
    client_id: 'id',
    client_secret: 'secret',
    redirect_uri: 'https://ronda.test/api/oauth/google/callback',
  });
  assert.ok(calls.filter((call) => call.url.includes('googleapis.com') && call.method === 'GET').every((call) => call.authorization === 'Bearer access-1'));

  for (const source of ['google_calendar', 'gmail']) {
    const connection = store.findConnection(token, source);
    assert.equal(connection?.account, 'ana@example.com');
    assert.equal(connection?.lastError, null);
    const tokens = JSON.parse(connection?.secret ?? '{}') as OAuthTokens;
    assert.equal(tokens.accessToken, 'access-1');
    assert.equal(tokens.refreshToken, 'refresh-1');
    assert.ok(tokens.expiresAt > Date.now() + 59 * MINUTE_MS);
  }

  const events = store.listEvents(token);
  const meetings = events.filter((event) => event.source === 'google_calendar');
  assert.deepEqual(meetings.map((event) => event.summary).sort(), ['Bloque de foco · 90 min', 'Planificación · 45 min · 3 asistentes']);
  assert.ok(meetings.every((event) => event.type === 'reunion'));
  const planning = meetings.find((event) => event.summary.startsWith('Planificación'));
  assert.equal(planning?.occurredAt, meetingStart);
  assert.deepEqual(planning?.raw, {
    id: 'ev_planning',
    title: 'Planificación',
    start: meetingStart,
    end: new Date(new Date(meetingStart).getTime() + 45 * MINUTE_MS).toISOString(),
    durationMinutes: 45,
    attendees: 3,
    declined: false,
  });

  const mails = events.filter((event) => event.source === 'gmail');
  assert.deepEqual(mails.map((event) => event.summary).sort(), ['(sin asunto) · de avisos@banco.cl', 'Presupuesto Q1 · de Tomás Pérez']);
  assert.ok(mails.every((event) => event.type === 'correo'));
});

test('the calendar request covers the lookback window plus the next seven days', async () => {
  const { calls, stateFor, callback } = setup();
  await callback({ code: 'code-1', state: stateFor() });
  const request = new URL(calls.find((call) => call.url.includes('/calendar/v3/'))?.url ?? '');
  assert.equal(request.searchParams.get('singleEvents'), 'true');
  assert.equal(request.searchParams.get('orderBy'), 'startTime');
  assert.equal(request.searchParams.get('maxResults'), '250');
  assert.ok(new Date(request.searchParams.get('timeMin') ?? '').getTime() < Date.now() - 13 * DAY_MS);
  const untilMs = new Date(request.searchParams.get('timeMax') ?? '').getTime() - Date.now();
  assert.ok(untilMs > 7 * DAY_MS - MINUTE_MS && untilMs <= 7 * DAY_MS);
});

test('mail keeps only subject, sender and date and never asks for or stores a body or snippet', async () => {
  const { store, token, calls, stateFor, callback } = setup();
  await callback({ code: 'code-1', state: stateFor() });

  const gmailCalls = calls.filter((call) => call.url.startsWith('https://gmail.googleapis.com'));
  const reads = gmailCalls.filter((call) => call.url.includes('/messages/'));
  assert.equal(reads.length, 4);
  assert.ok(reads.every((call) => new URL(call.url).searchParams.get('format') === 'metadata'));
  assert.ok(reads.every((call) => new URL(call.url).searchParams.getAll('metadataHeaders').sort().join() === 'Date,From,Subject'));
  assert.ok(gmailCalls.every((call) => !new URL(call.url).searchParams.has('q')));

  const mails = store.listEvents(token).filter((event) => event.source === 'gmail');
  for (const event of mails) assert.deepEqual(Object.keys(event.raw as object).sort(), ['date', 'from', 'subject']);
  assert.deepEqual(mails.find((event) => event.summary.startsWith('Presupuesto'))?.raw, {
    subject: 'Presupuesto Q1',
    from: 'Tomás Pérez <tomas@example.com>',
    date: new Date(recentMail).toISOString(),
  });

  const stored = JSON.stringify(store.listEvents(token));
  for (const secret of ['SNIPPET-PRIVADO', 'CUERPO-PRIVADO', 'AGENDA-PRIVADA', 'snippet', 'lu@example.com']) assert.ok(!stored.includes(secret));
});

test('declined, all-day and cancelled calendar events are skipped', async () => {
  const drafts = await googleCalendar.pull('access-1', 'ana@example.com', new Date(Date.now() - 14 * DAY_MS), fakeFetch(googleRoutes()));
  assert.deepEqual(drafts.map((draft) => draft.externalId), ['ev_planning', 'ev_focus']);
});

test('old mail and drafts are skipped', async () => {
  const drafts = await gmail.pull('access-1', 'ana@example.com', new Date(Date.now() - 14 * DAY_MS), fakeFetch(googleRoutes()));
  assert.deepEqual(drafts.map((draft) => draft.externalId), ['m_budget', 'm_bank']);
});

test('one source failing to sync does not stop the others or the redirect', async () => {
  const routes = googleRoutes({ 'https://gmail.googleapis.com/gmail/v1/users/me/messages': () => new Response('{}', { status: 403 }) });
  const { store, token, stateFor, callback } = setup(routes);
  const response = await callback({ code: 'code-1', state: stateFor() });
  assert.equal(response.status, 302);
  assert.equal(store.findConnection(token, 'google_calendar')?.lastError, null);
  assert.equal(store.findConnection(token, 'gmail')?.lastError, 'Google no permitió leer Gmail. Vuelve a conectar y acepta todos los permisos.');
  assert.deepEqual([...new Set(store.listEvents(token).map((event) => event.source))], ['google_calendar']);
});

test('importing twice does not duplicate events', async () => {
  const { ctx, store, token, stateFor, callback } = setup();
  await callback({ code: 'code-1', state: stateFor() });
  assert.equal(await syncSource(ctx, token, 'google_calendar'), 0);
  assert.equal(await syncSource(ctx, token, 'gmail'), 0);
  assert.equal(store.listEvents(token).length, 4);
});

test('an expired access token is refreshed during sync and the new token is persisted', async () => {
  const { ctx, store, token, calls } = setup();
  store.saveConnection(token, 'google_calendar', 'ana@example.com', JSON.stringify({ accessToken: 'access-expired', refreshToken: 'refresh-1', expiresAt: Date.now() - MINUTE_MS }));

  assert.equal(await syncSource(ctx, token, 'google_calendar'), 2);

  const refresh = calls.find((call) => call.url === 'https://oauth2.googleapis.com/token');
  assert.deepEqual(Object.fromEntries(refresh?.form ?? []), { grant_type: 'refresh_token', refresh_token: 'refresh-1', client_id: 'id', client_secret: 'secret' });
  assert.equal(calls.find((call) => call.url.includes('/calendar/v3/'))?.authorization, 'Bearer access-renewed');

  const tokens = JSON.parse(store.findConnection(token, 'google_calendar')?.secret ?? '{}') as OAuthTokens;
  assert.equal(tokens.accessToken, 'access-renewed');
  assert.equal(tokens.refreshToken, 'refresh-1');
  assert.ok(tokens.expiresAt > Date.now() + 59 * MINUTE_MS);
});

test('a valid access token is used without refreshing', async () => {
  const { ctx, store, token, calls } = setup();
  store.saveConnection(token, 'gmail', 'ana@example.com', JSON.stringify({ accessToken: 'access-1', refreshToken: 'refresh-1', expiresAt: Date.now() + 30 * MINUTE_MS }));
  assert.equal(await syncSource(ctx, token, 'gmail'), 2);
  assert.ok(calls.every((call) => call.url !== 'https://oauth2.googleapis.com/token'));
});

test('Google failures surface as short Spanish connector errors', async () => {
  const credentials = { clientId: 'id', clientSecret: 'secret' };
  const failing = (status: number) => fakeFetch({ 'https://': () => new Response('{}', { status }) });
  const offline = (async () => {
    throw new Error('offline');
  }) as unknown as Fetch;

  await assert.rejects(google.exchange('code', credentials, 'https://ronda.test/cb', failing(400), 'verifier'), (failure) => failure instanceof ConnectorError && failure.status === 400);
  await assert.rejects(google.refresh('refresh', credentials, failing(400)), { message: 'Google no aceptó la autorización. Vuelve a conectar tu cuenta.' });
  await assert.rejects(google.refresh('refresh', credentials, failing(503)), { message: 'Google respondió 503.' });
  await assert.rejects(google.exchange('code', credentials, 'https://ronda.test/cb', offline, 'verifier'), { message: 'No se pudo contactar a Google.' });
  await assert.rejects(google.identify('access', failing(401)), { message: 'Google dio por vencido el acceso. Vuelve a conectar tu cuenta.' });
  await assert.rejects(google.identify('access', fakeFetch({ 'https://': () => Response.json({ sub: '1' }) })), ConnectorError);
});
