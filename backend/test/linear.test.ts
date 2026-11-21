import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linear } from '../src/connectors/linear.js';
import { CONNECTORS } from '../src/connectors/registry.js';
import { createContext } from '../src/context.js';
import { linear as linearProvider } from '../src/oauth/linear.js';
import { syncSource } from '../src/sync.js';
import { ConnectorError, type Fetch } from '../src/types.js';

if (!CONNECTORS.some((connector) => connector.id === 'linear')) CONNECTORS.push(linear);

interface SeenRequest {
  url: string;
  method: string;
  authorization: string;
  contentType: string;
  query: string;
  variables: Record<string, unknown>;
}

const updatedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
const createdAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

const issue = (overrides: Record<string, unknown> = {}) => ({
  id: 'issue-uuid-1',
  identifier: 'VIT-123',
  title: 'Webhook de pagos',
  url: 'https://linear.app/acme/issue/VIT-123',
  updatedAt,
  createdAt,
  dueDate: '2026-12-01',
  priority: 2,
  state: { name: 'En progreso', type: 'started' },
  ...overrides,
});

const authenticationFailure = {
  errors: [{ message: 'Authentication required, not authenticated', extensions: { type: 'authentication error', code: 'AUTHENTICATION_ERROR' } }],
};

const linearFetch = (issues: () => unknown[], seen: SeenRequest[] = []): Fetch =>
  (async (input: Parameters<Fetch>[0], init?: Parameters<Fetch>[1]) => {
    const headers = new Headers(init?.headers);
    const body = JSON.parse(String(init?.body ?? '{}')) as { query?: string; variables?: Record<string, unknown> };
    const request: SeenRequest = {
      url: String(input),
      method: init?.method ?? 'GET',
      authorization: headers.get('authorization') ?? '',
      contentType: headers.get('content-type') ?? '',
      query: body.query ?? '',
      variables: body.variables ?? {},
    };
    seen.push(request);
    if (request.authorization.includes('bad')) return Response.json(authenticationFailure, { status: 401 });
    if (request.query.includes('assignedIssues')) return Response.json({ data: { viewer: { assignedIssues: { nodes: issues() } } } });
    return Response.json({ data: { viewer: { id: 'user-1', name: 'Ana', email: 'ana@example.com' } } });
  }) as Fetch;

const respondingWith = (response: () => Response): Fetch => (async () => response()) as Fetch;

const rejection = async (attempt: Promise<unknown>): Promise<ConnectorError> => {
  const failure = await attempt.then(
    () => null,
    (reason: unknown) => reason,
  );
  assert.ok(failure instanceof ConnectorError);
  return failure;
};

test('identify returns the email of the account owner', async () => {
  const seen: SeenRequest[] = [];
  const account = await linearProvider.identify('lin_oauth_good', linearFetch(() => [], seen));

  assert.equal(account, 'ana@example.com');
  assert.equal(seen.length, 1);
  assert.equal(seen[0]?.url, 'https://api.linear.app/graphql');
  assert.equal(seen[0]?.method, 'POST');
  assert.equal(seen[0]?.contentType, 'application/json');
  assert.equal(seen[0]?.authorization, 'Bearer lin_oauth_good');
  assert.ok(seen[0]?.query.includes('viewer'));
  assert.ok(seen[0]?.query.includes('email'));
});

test('an access rejected with 401 maps to status 400 and the Spanish message', async () => {
  const failure = await rejection(linearProvider.identify('bad', linearFetch(() => [])));
  assert.equal(failure.status, 400);
  assert.equal(failure.message, 'Linear dio por vencido el acceso. Vuelve a conectar tu cuenta.');
});

test('an authentication error inside a 200 response is also a rejected access', async () => {
  const failure = await rejection(linear.pull('lin_oauth_x', 'ana@example.com', since, respondingWith(() => Response.json(authenticationFailure))));
  assert.equal(failure.status, 400);
  assert.equal(failure.message, 'Linear dio por vencido el acceso. Vuelve a conectar tu cuenta.');
});

test('an account without an email is not accepted', async () => {
  const failure = await rejection(linearProvider.identify('lin_oauth_good', respondingWith(() => Response.json({ data: { viewer: {} } }))));
  assert.equal(failure.message, 'Linear no entregó el correo de la cuenta.');
});

test('pull maps every assigned issue to a task event', async () => {
  const drafts = await linear.pull('lin_oauth_good', 'ana@example.com', since, linearFetch(() => [issue()]));

  assert.deepEqual(drafts, [
    {
      source: 'linear',
      type: 'tarea',
      externalId: `issue-uuid-1:${updatedAt}`,
      occurredAt: updatedAt,
      summary: 'VIT-123 Webhook de pagos · En progreso',
      raw: {
        identifier: 'VIT-123',
        title: 'Webhook de pagos',
        url: 'https://linear.app/acme/issue/VIT-123',
        state: 'En progreso',
        stateType: 'started',
        priority: 2,
        dueDate: '2026-12-01',
        createdAt,
        updatedAt,
      },
    },
  ]);
});

test('pull sends the access token as Bearer and passes since as a variable', async () => {
  const seen: SeenRequest[] = [];
  await linear.pull('lin_oauth_good', 'ana@example.com', since, linearFetch(() => [], seen));

  assert.equal(seen.length, 1);
  assert.equal(seen[0]?.authorization, 'Bearer lin_oauth_good');
  assert.equal(seen[0]?.method, 'POST');
  assert.deepEqual(seen[0]?.variables, { since: since.toISOString() });
  assert.ok(seen[0]?.query.includes('$since'));
  assert.ok(seen[0]?.query.includes('updatedAt: { gte: $since }'));
});

test('a network failure, a rate limit and a server error each get their own message', async () => {
  const offline = await rejection(
    linear.pull('lin_oauth_good', 'ana@example.com', since, (async () => {
      throw new Error('offline');
    }) as Fetch),
  );
  assert.equal(offline.message, 'No se pudo contactar a Linear.');
  assert.equal(offline.status, 502);

  const limited = await rejection(linear.pull('lin_oauth_good', 'ana@example.com', since, respondingWith(() => new Response('{}', { status: 429 }))));
  assert.equal(limited.status, 429);

  const broken = await rejection(linear.pull('lin_oauth_good', 'ana@example.com', since, respondingWith(() => new Response('oops', { status: 500 }))));
  assert.equal(broken.message, 'Linear respondió 500.');
  assert.equal(broken.status, 502);
});

test('a GraphQL error that is not about the access is not reported as a rejected access', async () => {
  const failure = await rejection(
    linear.pull('lin_oauth_good', 'ana@example.com', since, respondingWith(() => Response.json({ errors: [{ message: 'Cannot query field', extensions: { code: 'GRAPHQL_VALIDATION_FAILED' } }] }))),
  );
  assert.equal(failure.status, 502);
  assert.notEqual(failure.message, 'Linear dio por vencido el acceso. Vuelve a conectar tu cuenta.');
});

test('syncing twice imports an issue once and a later update becomes a new event', async () => {
  let issues = [issue()];
  const ctx = createContext({ location: ':memory:', fetch: linearFetch(() => issues) });
  const { token } = ctx.store.addPerson('Ana');
  ctx.store.saveConnection(token, 'linear', 'ana@example.com', JSON.stringify({ accessToken: 'lin_oauth_good', refreshToken: null, expiresAt: Date.now() + 60 * 60 * 1000 }));

  assert.equal(await syncSource(ctx, token, 'linear'), 1);
  assert.equal(await syncSource(ctx, token, 'linear'), 0);

  issues = [issue({ updatedAt: new Date().toISOString(), state: { name: 'Terminado', type: 'completed' } })];
  assert.equal(await syncSource(ctx, token, 'linear'), 1);

  const summaries = ctx.store.listEvents(token).map((event) => event.summary);
  assert.deepEqual(summaries, ['VIT-123 Webhook de pagos · Terminado', 'VIT-123 Webhook de pagos · En progreso']);
  assert.equal(ctx.store.findConnection(token, 'linear')?.lastError, null);
});
