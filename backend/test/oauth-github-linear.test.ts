import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { createContext, loadConfig, type Config } from '../src/context.js';
import { github } from '../src/oauth/github.js';
import { linear } from '../src/oauth/linear.js';
import { syncSource } from '../src/sync.js';
import type { Fetch, OAuthTokens } from '../src/types.js';

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const YEAR_MS = 365 * DAY_MS;
const OWN_PAGE = { 'sec-fetch-site': 'same-origin' };
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const LINEAR_TOKEN_URL = 'https://api.linear.app/oauth/token';
const LINEAR_GRAPHQL_URL = 'https://api.linear.app/graphql';

const githubCredentials = { clientId: 'gh-id', clientSecret: 'gh-secret' };
const linearCredentials = { clientId: 'lin-id', clientSecret: 'lin-secret' };
const config: Config = { publicBaseUrl: 'https://ronda.test', oauth: { github: githubCredentials, linear: linearCredentials } };

const recent = new Date(Date.now() - 60 * MINUTE_MS).toISOString();
const old = new Date(Date.now() - 60 * DAY_MS).toISOString();

interface Call {
  url: string;
  method: string;
  authorization: string;
  accept: string;
  userAgent: string;
  contentType: string;
  body: string;
  form: URLSearchParams;
}

type Routes = Record<string, (call: Call) => Response>;

const fakeFetch = (routes: Routes, calls: Call[] = []): Fetch =>
  (async (input: Parameters<Fetch>[0], init?: Parameters<Fetch>[1]) => {
    const headers = new Headers(init?.headers);
    const body = typeof init?.body === 'string' ? init.body : '';
    const call: Call = {
      url: String(input),
      method: init?.method ?? 'GET',
      authorization: headers.get('authorization') ?? '',
      accept: headers.get('accept') ?? '',
      userAgent: headers.get('user-agent') ?? '',
      contentType: headers.get('content-type') ?? '',
      body,
      form: new URLSearchParams(body),
    };
    calls.push(call);
    const match = Object.keys(routes).find((prefix) => call.url.startsWith(prefix));
    return match ? routes[match]!(call) : new Response('{}', { status: 404 });
  }) as Fetch;

const githubActivity = [
  { id: '1', type: 'PushEvent', created_at: recent, repo: { name: 'acme/pagos' }, payload: { size: 3 } },
  { id: '2', type: 'PullRequestEvent', created_at: recent, repo: { name: 'acme/pagos' }, payload: { action: 'closed', pull_request: { title: 'Webhook', merged: true } } },
  { id: '3', type: 'WatchEvent', created_at: recent, repo: { name: 'acme/otro' }, payload: {} },
  { id: '4', type: 'PushEvent', created_at: old, repo: { name: 'acme/viejo' }, payload: { size: 1 } },
];

const linearIssue = {
  id: 'issue-uuid-1',
  identifier: 'VIT-123',
  title: 'Webhook de pagos',
  url: 'https://linear.app/acme/issue/VIT-123',
  updatedAt: recent,
  createdAt: recent,
  dueDate: null,
  priority: 2,
  state: { name: 'En progreso', type: 'started' },
};

const githubRoutes = (overrides: Routes = {}): Routes => ({
  [GITHUB_TOKEN_URL]: () => Response.json({ access_token: 'gho-access', token_type: 'bearer', scope: 'read:user' }),
  'https://api.github.com/users/ana/events': () => Response.json(githubActivity),
  'https://api.github.com/user': () => Response.json({ login: 'ana', id: 1 }),
  ...overrides,
});

const linearRoutes = (overrides: Routes = {}): Routes => ({
  [LINEAR_TOKEN_URL]: (call) =>
    call.form.get('grant_type') === 'refresh_token'
      ? Response.json({ access_token: 'lin-renewed', refresh_token: 'lin-refresh-2', expires_in: 86_400, token_type: 'Bearer' })
      : Response.json({ access_token: 'lin-access', refresh_token: 'lin-refresh-1', expires_in: 86_400, token_type: 'Bearer', scope: 'read' }),
  [LINEAR_GRAPHQL_URL]: (call) =>
    call.body.includes('assignedIssues')
      ? Response.json({ data: { viewer: { assignedIssues: { nodes: [linearIssue] } } } })
      : Response.json({ data: { viewer: { email: 'ana@example.com' } } }),
  ...overrides,
});

const setup = (routes: Routes, options: { config?: Config } = {}) => {
  const calls: Call[] = [];
  const ctx = createContext({ location: ':memory:', fetch: fakeFetch(routes, calls), config: options.config ?? config });
  const app = createApp(ctx);
  const { token } = ctx.store.addPerson('Ana');
  const start = (provider: string) => app.request(`/api/people/${token}/oauth/${provider}/start`, { headers: OWN_PAGE });
  const connect = async (provider: string, code = 'code-1') => {
    const started = await start(provider);
    assert.equal(started.status, 302);
    const state = new URL(started.headers.get('location') ?? '').searchParams.get('state') ?? '';
    const cookie = (started.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
    assert.ok(state && cookie.startsWith(`ronda_oauth_${provider}=`));
    return app.request(`/api/oauth/${provider}/callback?${new URLSearchParams({ code, state })}`, { headers: { cookie } });
  };
  const tokensOf = (source: string) => JSON.parse(ctx.store.findConnection(token, source)?.secret ?? '{}') as OAuthTokens;
  const sourcesOf = async () => {
    const page = (await (await app.request(`/api/people/${token}`)).json()) as { sources: Array<Record<string, unknown>> };
    return Object.fromEntries(page.sources.map((source) => [String(source.id), source]));
  };
  return { ctx, store: ctx.store, app, token, calls, start, connect, tokensOf, sourcesOf };
};

test('start redirects to GitHub with the client, the scopes and the callback of this server', async () => {
  const { start } = setup(githubRoutes());
  const response = await start('github');
  assert.equal(response.status, 302);

  const location = new URL(response.headers.get('location') ?? '');
  assert.equal(`${location.origin}${location.pathname}`, 'https://github.com/login/oauth/authorize');
  assert.equal(location.searchParams.get('client_id'), 'gh-id');
  assert.equal(location.searchParams.get('redirect_uri'), 'https://ronda.test/api/oauth/github/callback');
  assert.equal(location.searchParams.get('scope'), 'read:user');
  assert.ok(location.searchParams.get('state'));
  assert.ok(!location.search.includes('gh-secret'));
});

test('start redirects to Linear with the client, the scopes, consent and the callback of this server', async () => {
  const { start } = setup(linearRoutes());
  const response = await start('linear');
  assert.equal(response.status, 302);

  const location = new URL(response.headers.get('location') ?? '');
  assert.equal(`${location.origin}${location.pathname}`, 'https://linear.app/oauth/authorize');
  assert.equal(location.searchParams.get('client_id'), 'lin-id');
  assert.equal(location.searchParams.get('redirect_uri'), 'https://ronda.test/api/oauth/linear/callback');
  assert.equal(location.searchParams.get('response_type'), 'code');
  assert.equal(location.searchParams.get('scope'), 'read');
  assert.equal(location.searchParams.get('prompt'), 'consent');
  assert.ok(location.searchParams.get('state'));
  assert.ok(!location.search.includes('lin-secret'));
});

test('GitHub joins several scopes with spaces and Linear with commas', () => {
  const input = { redirectUri: 'https://ronda.test/cb', state: 's', codeChallenge: 'c' };
  const githubUrl = new URL(github.authorizeUrl({ ...input, credentials: githubCredentials, scopes: ['read:user', 'repo'] }));
  const linearUrl = new URL(linear.authorizeUrl({ ...input, credentials: linearCredentials, scopes: ['read', 'issues:create'] }));
  assert.equal(githubUrl.searchParams.get('scope'), 'read:user repo');
  assert.equal(linearUrl.searchParams.get('scope'), 'read,issues:create');
});

test('a GitHub callback stores the connection and imports recent pushes and pull requests', async () => {
  const { store, token, calls, connect, tokensOf, sourcesOf } = setup(githubRoutes());
  const response = await connect('github');
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), `/conectar/${token}`);

  const exchange = calls.find((call) => call.url === GITHUB_TOKEN_URL);
  assert.equal(exchange?.method, 'POST');
  assert.equal(exchange?.accept, 'application/json');
  assert.deepEqual(Object.fromEntries(exchange?.form ?? []), {
    client_id: 'gh-id',
    client_secret: 'gh-secret',
    code: 'code-1',
    redirect_uri: 'https://ronda.test/api/oauth/github/callback',
  });

  const reads = calls.filter((call) => call.url.startsWith('https://api.github.com'));
  assert.deepEqual(reads.map((call) => call.url), ['https://api.github.com/user', 'https://api.github.com/users/ana/events?per_page=100']);
  assert.ok(reads.every((call) => call.authorization === 'Bearer gho-access' && call.accept === 'application/vnd.github+json' && call.userAgent !== ''));

  const connection = store.findConnection(token, 'github');
  assert.equal(connection?.account, 'ana');
  assert.equal(connection?.lastError, null);
  assert.equal(tokensOf('github').accessToken, 'gho-access');
  assert.equal(tokensOf('github').refreshToken, null);
  assert.ok(tokensOf('github').expiresAt > Date.now() + 9 * YEAR_MS);

  assert.deepEqual(store.listEvents(token).map((event) => event.summary).sort(), ['3 commits en acme/pagos', 'PR mergeado en acme/pagos: Webhook']);
  assert.ok(store.listEvents(token).every((event) => event.source === 'github'));

  const source = (await sourcesOf()).github;
  assert.equal(source?.connect, 'oauth');
  assert.equal(source?.provider, 'github');
  assert.equal(source?.how, 'Cuenta de GitHub');
  assert.deepEqual((source?.connection as { account: string }).account, 'ana');
});

test('a Linear callback stores the connection and imports the assigned issues with Bearer', async () => {
  const { store, token, calls, connect, tokensOf, sourcesOf } = setup(linearRoutes());
  const response = await connect('linear');
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), `/conectar/${token}`);

  const exchange = calls.find((call) => call.url === LINEAR_TOKEN_URL);
  assert.equal(exchange?.method, 'POST');
  assert.equal(exchange?.contentType, 'application/x-www-form-urlencoded');
  assert.deepEqual(Object.fromEntries(exchange?.form ?? []), {
    grant_type: 'authorization_code',
    code: 'code-1',
    client_id: 'lin-id',
    client_secret: 'lin-secret',
    redirect_uri: 'https://ronda.test/api/oauth/linear/callback',
  });

  const queries = calls.filter((call) => call.url === LINEAR_GRAPHQL_URL);
  assert.equal(queries.length, 2);
  assert.ok(queries.every((call) => call.method === 'POST' && call.authorization === 'Bearer lin-access'));
  assert.ok(queries[0]?.body.includes('viewer { email }'));

  const connection = store.findConnection(token, 'linear');
  assert.equal(connection?.account, 'ana@example.com');
  assert.equal(connection?.lastError, null);
  assert.equal(tokensOf('linear').accessToken, 'lin-access');
  assert.equal(tokensOf('linear').refreshToken, 'lin-refresh-1');
  assert.ok(tokensOf('linear').expiresAt > Date.now() + 23 * 60 * MINUTE_MS);
  assert.ok(tokensOf('linear').expiresAt < Date.now() + 25 * 60 * MINUTE_MS);

  assert.deepEqual(store.listEvents(token).map((event) => [event.source, event.type, event.summary]), [['linear', 'tarea', 'VIT-123 Webhook de pagos · En progreso']]);

  const source = (await sourcesOf()).linear;
  assert.equal(source?.connect, 'oauth');
  assert.equal(source?.provider, 'linear');
  assert.equal(source?.how, 'Cuenta de Linear');
});

test('a Linear grant without expiry or refresh token is kept as non-expiring', async () => {
  const routes = linearRoutes({ [LINEAR_TOKEN_URL]: () => Response.json({ access_token: 'lin-access', token_type: 'Bearer', scope: 'read' }) });
  const { ctx, token, calls, connect, tokensOf } = setup(routes);
  await connect('linear');
  assert.equal(tokensOf('linear').refreshToken, null);
  assert.ok(tokensOf('linear').expiresAt > Date.now() + 9 * YEAR_MS);

  assert.equal(await syncSource(ctx, token, 'linear'), 0);
  assert.equal(calls.filter((call) => call.url === LINEAR_TOKEN_URL).length, 1);
});

test('an expired Linear access is refreshed with the stored refresh token and the rotated one is kept', async () => {
  const { ctx, store, token, calls, tokensOf } = setup(linearRoutes());
  store.saveConnection(token, 'linear', 'ana@example.com', JSON.stringify({ accessToken: 'lin-expired', refreshToken: 'lin-refresh-1', expiresAt: Date.now() - MINUTE_MS }));

  assert.equal(await syncSource(ctx, token, 'linear'), 1);

  const refresh = calls.find((call) => call.url === LINEAR_TOKEN_URL);
  assert.deepEqual(Object.fromEntries(refresh?.form ?? []), { grant_type: 'refresh_token', refresh_token: 'lin-refresh-1', client_id: 'lin-id', client_secret: 'lin-secret' });
  assert.equal(calls.find((call) => call.url === LINEAR_GRAPHQL_URL)?.authorization, 'Bearer lin-renewed');
  assert.equal(tokensOf('linear').accessToken, 'lin-renewed');
  assert.equal(tokensOf('linear').refreshToken, 'lin-refresh-2');
});

test('a GitHub answer of HTTP 200 with an error is a failure and stores nothing', async () => {
  const routes = githubRoutes({
    [GITHUB_TOKEN_URL]: () => Response.json({ error: 'bad_verification_code', error_description: 'The code passed is incorrect or expired.' }),
  });
  const { store, token, calls, connect } = setup(routes);
  const response = await connect('github');

  assert.equal(response.status, 302);
  const location = new URL(response.headers.get('location') ?? '', 'https://ronda.test');
  assert.equal(location.pathname, `/conectar/${token}`);
  assert.equal(location.searchParams.get('aviso'), 'GitHub no aceptó la autorización. Vuelve a conectar tu cuenta.');
  assert.ok(calls.every((call) => !call.url.startsWith('https://api.github.com')));
  assert.deepEqual(store.listConnections(token), []);
  assert.deepEqual(store.listEvents(token), []);
});

test('GitHub token failures are short Spanish errors that never carry a secret', async () => {
  const answering = (body: unknown, status = 200) => fakeFetch({ [GITHUB_TOKEN_URL]: () => Response.json(body, { status }) });
  const exchange = (fetchImpl: Fetch) => github.exchange('code-1', githubCredentials, 'https://ronda.test/cb', fetchImpl, 'verifier');

  await assert.rejects(exchange(answering({ error: 'incorrect_client_credentials' })), { message: 'GitHub rechazó las credenciales del servidor.', status: 500 });
  await assert.rejects(exchange(answering({ error: 'bad_verification_code' })), { message: 'GitHub no aceptó la autorización. Vuelve a conectar tu cuenta.', status: 400 });
  await assert.rejects(exchange(answering({ token_type: 'bearer' })), { message: 'GitHub respondió sin acceso.' });
  await assert.rejects(exchange(answering({}, 503)), { message: 'GitHub respondió 503.' });
  await assert.rejects(
    exchange((async () => {
      throw new Error('offline gh-secret');
    }) as unknown as Fetch),
    { message: 'No se pudo contactar a GitHub.' },
  );
});

test('a non-expiring GitHub token is not refreshed on sync', async () => {
  const { ctx, token, calls, connect } = setup(githubRoutes());
  await connect('github');
  assert.equal(calls.filter((call) => call.url === GITHUB_TOKEN_URL).length, 1);

  assert.equal(await syncSource(ctx, token, 'github'), 0);

  assert.equal(calls.filter((call) => call.url === GITHUB_TOKEN_URL).length, 1);
  assert.equal(calls.at(-1)?.authorization, 'Bearer gho-access');
  assert.equal(ctx.store.findConnection(token, 'github')?.lastError, null);
});

test('a GitHub App grant with expiry and refresh token is honoured and refreshed when it expires', async () => {
  const routes = githubRoutes({
    [GITHUB_TOKEN_URL]: (call) =>
      call.form.get('grant_type') === 'refresh_token'
        ? Response.json({ access_token: 'ghu-renewed', refresh_token: 'ghr-2', expires_in: 28_800 })
        : Response.json({ access_token: 'ghu-access', refresh_token: 'ghr-1', expires_in: 28_800 }),
  });
  const { ctx, store, token, calls, connect, tokensOf } = setup(routes);
  await connect('github');
  assert.equal(tokensOf('github').refreshToken, 'ghr-1');
  assert.ok(tokensOf('github').expiresAt < Date.now() + 9 * 60 * MINUTE_MS);

  store.updateSecret(token, 'github', JSON.stringify({ ...tokensOf('github'), expiresAt: Date.now() - MINUTE_MS }));
  await syncSource(ctx, token, 'github');

  const refresh = calls.filter((call) => call.url === GITHUB_TOKEN_URL).at(-1);
  assert.deepEqual(Object.fromEntries(refresh?.form ?? []), { grant_type: 'refresh_token', refresh_token: 'ghr-1', client_id: 'gh-id', client_secret: 'gh-secret' });
  assert.equal(calls.at(-1)?.authorization, 'Bearer ghu-renewed');
  assert.equal(tokensOf('github').refreshToken, 'ghr-2');
});

test('a provider without credentials refuses to start and is reported as not configured', async () => {
  const { start, sourcesOf, calls } = setup(githubRoutes(), { config: { publicBaseUrl: 'https://ronda.test', oauth: { linear: linearCredentials } } });

  const response = await start('github');
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: 'Falta configurar github en el servidor: define GITHUB_CLIENT_ID y GITHUB_CLIENT_SECRET.' });
  assert.equal((await start('linear')).status, 302);
  assert.equal(calls.length, 0);

  const sources = await sourcesOf();
  assert.equal(sources.github?.configured, false);
  assert.equal(sources.linear?.configured, true);
  assert.equal(sources.google_calendar?.configured, false);
  assert.equal(sources.gmail?.configured, false);
  assert.equal(sources.granola?.configured, false);
  assert.equal(sources.apple_health?.configured, true);
});

test('Linear without credentials gets its own message', async () => {
  const { start } = setup(linearRoutes(), { config: { publicBaseUrl: null, oauth: {} } });
  const response = await start('linear');
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: 'Falta configurar linear en el servidor: define LINEAR_CLIENT_ID y LINEAR_CLIENT_SECRET.' });
});

test('the person payload keeps every field the page reads and never shows a token or a client secret', async () => {
  const { app, token, connect } = setup({ ...githubRoutes(), ...linearRoutes() });
  await connect('github');
  await connect('linear');

  const text = await (await app.request(`/api/people/${token}`)).text();
  const page = JSON.parse(text) as { sources: Array<Record<string, unknown>> };
  for (const source of page.sources) {
    assert.deepEqual(Object.keys(source).sort(), ['configured', 'connect', 'connection', 'delivery', 'how', 'id', 'label', 'provider', 'sync']);
  }
  for (const secret of ['gho-access', 'lin-access', 'lin-refresh-1', 'gh-secret', 'lin-secret']) assert.ok(!text.includes(secret));
});

test('disconnecting an OAuth source removes the connection and its events', async () => {
  const { app, store, token, connect } = setup({ ...githubRoutes(), ...linearRoutes() });
  await connect('github');
  await connect('linear');
  assert.equal(store.listEvents(token).length, 3);

  const response = await app.request(`/api/people/${token}/connections/github`, { method: 'DELETE' });
  assert.equal(response.status, 200);
  assert.equal(store.findConnection(token, 'github'), undefined);
  assert.deepEqual(store.listEvents(token).map((event) => event.source), ['linear']);
  assert.equal(store.findConnection(token, 'linear')?.account, 'ana@example.com');
});

test('a connection saved when the source used a key asks to reconnect instead of calling the source', async () => {
  const { ctx, store, token, calls } = setup({ ...githubRoutes(), ...linearRoutes() });
  store.saveConnection(token, 'github', 'ana', 'ghp_llave_antigua');
  store.saveConnection(token, 'linear', 'ana@example.com', 'lin_api_llave_antigua');

  for (const source of ['github', 'linear']) {
    await assert.rejects(syncSource(ctx, token, source), { message: 'Esta fuente ahora se conecta con tu cuenta. Vuelve a conectarla.', status: 400 });
    assert.equal(store.findConnection(token, source)?.lastError, 'Esta fuente ahora se conecta con tu cuenta. Vuelve a conectarla.');
  }
  assert.equal(calls.length, 0);
});

test('credentials are read for every registered provider from its own variables', () => {
  const loaded = loadConfig({ GITHUB_CLIENT_ID: 'gh-id', GITHUB_CLIENT_SECRET: 'gh-secret', LINEAR_CLIENT_ID: 'lin-id', GOOGLE_CLIENT_SECRET: 'solo-secreto' });
  assert.deepEqual(loaded.oauth.github, githubCredentials);
  assert.equal(loaded.oauth.linear, undefined);
  assert.equal(loaded.oauth.google, undefined);
  assert.deepEqual(loadConfig({ LINEAR_CLIENT_ID: 'lin-id', LINEAR_CLIENT_SECRET: 'lin-secret' }).oauth.linear, linearCredentials);
  assert.deepEqual(loadConfig({ GOOGLE_CLIENT_ID: 'g-id', GOOGLE_CLIENT_SECRET: 'g-secret' }).oauth.google, { clientId: 'g-id', clientSecret: 'g-secret' });
});
