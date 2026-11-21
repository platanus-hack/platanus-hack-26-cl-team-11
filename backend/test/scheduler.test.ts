import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as wait } from 'node:timers/promises';
import { linear } from '../src/connectors/linear.js';
import { CONNECTORS } from '../src/connectors/registry.js';
import { createContext } from '../src/context.js';
import { startScheduler, syncAll } from '../src/scheduler.js';
import type { Fetch } from '../src/types.js';

if (!CONNECTORS.some((connector) => connector.id === 'linear')) CONNECTORS.push(linear);

const tokensOf = (accessToken: string) => JSON.stringify({ accessToken, refreshToken: null, expiresAt: Date.now() + 60 * 60 * 1000 });

const recent = new Date(Date.now() - 60 * 60 * 1000).toISOString();

const githubEvents = [{ id: '1', type: 'PushEvent', created_at: recent, repo: { name: 'acme/pagos' }, payload: { size: 3 } }];

const linearIssues = {
  data: {
    viewer: {
      assignedIssues: {
        nodes: [
          {
            id: 'issue-uuid-1',
            identifier: 'VIT-123',
            title: 'Webhook de pagos',
            url: 'https://linear.app/acme/issue/VIT-123',
            updatedAt: recent,
            createdAt: recent,
            dueDate: null,
            priority: 2,
            state: { name: 'En progreso', type: 'started' },
          },
        ],
      },
    },
  },
};

interface Traffic {
  calls: number;
  inFlight: number;
  peakInFlight: number;
}

const newTraffic = (): Traffic => ({ calls: 0, inFlight: 0, peakInFlight: 0 });

const sourcesFetch = (traffic: Traffic = newTraffic(), delayMs = 0): Fetch =>
  (async (input: Parameters<Fetch>[0], init?: Parameters<Fetch>[1]) => {
    traffic.calls += 1;
    traffic.inFlight += 1;
    traffic.peakInFlight = Math.max(traffic.peakInFlight, traffic.inFlight);
    try {
      if (delayMs > 0) await wait(delayMs);
      const url = String(input);
      const authorization = new Headers(init?.headers).get('authorization') ?? '';
      if (authorization.includes('bad')) return new Response('{}', { status: 401 });
      if (url.startsWith('https://api.linear.app/graphql')) return Response.json(linearIssues);
      if (url.startsWith('https://api.github.com/users/')) return Response.json(githubEvents);
      return new Response('{}', { status: 404 });
    } finally {
      traffic.inFlight -= 1;
    }
  }) as Fetch;

test('syncAll syncs every connection of every person', async () => {
  const ctx = createContext({ location: ':memory:', fetch: sourcesFetch() });
  const ana = ctx.store.addPerson('Ana');
  const tomas = ctx.store.addPerson('Tomás');
  ctx.store.saveConnection(ana.token, 'github', 'ana', tokensOf('gho_good'));
  ctx.store.saveConnection(ana.token, 'linear', 'ana@example.com', tokensOf('lin_oauth_good'));
  ctx.store.saveConnection(tomas.token, 'github', 'tomas', tokensOf('gho_good'));

  assert.deepEqual(await syncAll(ctx), { synced: 3, failed: 0 });

  assert.deepEqual(ctx.store.listEvents(ana.token).map((event) => event.source).sort(), ['github', 'linear']);
  assert.deepEqual(ctx.store.listEvents(tomas.token).map((event) => event.source), ['github']);
  for (const { personToken, source } of ctx.store.listAllConnections()) {
    const connection = ctx.store.findConnection(personToken, source);
    assert.ok(connection?.lastSyncedAt);
    assert.equal(connection?.lastError, null);
  }
});

test('a failing connection is counted, keeps its error and does not stop the others', async () => {
  const ctx = createContext({ location: ':memory:', fetch: sourcesFetch() });
  const ana = ctx.store.addPerson('Ana');
  const tomas = ctx.store.addPerson('Tomás');
  ctx.store.saveConnection(ana.token, 'github', 'ana', tokensOf('bad'));
  ctx.store.saveConnection(ana.token, 'linear', 'ana@example.com', tokensOf('lin_oauth_good'));
  ctx.store.saveConnection(tomas.token, 'github', 'tomas', tokensOf('bad'));
  ctx.store.saveConnection(tomas.token, 'linear', 'tomas@example.com', tokensOf('lin_oauth_good'));

  assert.deepEqual(await syncAll(ctx), { synced: 2, failed: 2 });

  assert.equal(ctx.store.findConnection(ana.token, 'github')?.lastError, 'GitHub dio por vencido el acceso. Vuelve a conectar tu cuenta.');
  assert.equal(ctx.store.findConnection(tomas.token, 'github')?.lastError, 'GitHub dio por vencido el acceso. Vuelve a conectar tu cuenta.');
  assert.equal(ctx.store.findConnection(ana.token, 'linear')?.lastError, null);
  assert.equal(ctx.store.findConnection(tomas.token, 'linear')?.lastError, null);
  assert.equal(ctx.store.listEvents(ana.token).length, 1);
  assert.equal(ctx.store.listEvents(tomas.token).length, 1);
});

test('syncAll with no connections does nothing', async () => {
  const traffic = newTraffic();
  const ctx = createContext({ location: ':memory:', fetch: sourcesFetch(traffic) });
  ctx.store.addPerson('Ana');

  assert.deepEqual(await syncAll(ctx), { synced: 0, failed: 0 });
  assert.equal(traffic.calls, 0);
});

test('startScheduler runs on its interval and the stop function prevents further runs', async () => {
  const traffic = newTraffic();
  const ctx = createContext({ location: ':memory:', fetch: sourcesFetch(traffic) });
  const ana = ctx.store.addPerson('Ana');
  ctx.store.saveConnection(ana.token, 'github', 'ana', tokensOf('gho_good'));

  const stop = startScheduler(ctx, 10);
  assert.equal(traffic.calls, 0);
  await wait(120);
  stop();
  await wait(30);

  const callsWhenStopped = traffic.calls;
  assert.ok(callsWhenStopped >= 2);
  assert.equal(ctx.store.listEvents(ana.token).length, 1);

  await wait(100);
  assert.equal(traffic.calls, callsWhenStopped);
});

test('a tick is skipped while the previous run is still in flight', async () => {
  const traffic = newTraffic();
  const ctx = createContext({ location: ':memory:', fetch: sourcesFetch(traffic, 60) });
  const ana = ctx.store.addPerson('Ana');
  ctx.store.saveConnection(ana.token, 'github', 'ana', tokensOf('gho_good'));

  const stop = startScheduler(ctx, 5);
  await wait(200);
  stop();
  await wait(100);

  assert.equal(traffic.peakInFlight, 1);
  assert.ok(traffic.calls >= 2);
  assert.ok(traffic.calls <= 4);
});
