import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createApp } from '../src/app.js';
import { meetingsIn } from '../src/connectors/granola.js';
import { createContext, type Config } from '../src/context.js';
import type { Fetch } from '../src/types.js';

const OWN_PAGE = { 'sec-fetch-site': 'same-origin' };
const TOKEN_URL = 'https://mcp-auth.granola.ai/oauth2/token';
const MCP_URL = 'https://mcp.granola.ai/mcp';
const config: Config = { publicBaseUrl: 'https://ronda.test', oauth: { granola: { clientId: 'grn-id', clientSecret: 'grn-secret' } } };
const today = new Date().toISOString();

const listing = (cursor: string | null) =>
  [
    `<pagination has_more="${cursor ? 'true' : 'false'}" total_count="2" ${cursor ? `next_cursor="${cursor}" ` : ''}/>`,
    '<upcoming_meetings count="1">',
    `<upcoming_meeting id="evt_1" title="Todavía no ocurre" meeting_at="${today}">`,
    '</upcoming_meeting>',
    '</upcoming_meetings>',
    '<meetings_data connected_user_email="ana@example.com" workspace_name="Acme">',
    `<meeting id="note-1" title="Planificación &amp; pagos" meeting_at="${today}" created_at="${today}" organizer="tomas@example.com">`,
    '<known_participants total="2" omitted="2">',
    '</known_participants>',
    '<folders />',
    '</meeting>',
    '',
    `<meeting id="note-2" title="" created_at="${today}">`,
    '<folders />',
    '</meeting>',
    '</meetings_data>',
  ].join('\n');

interface Call {
  url: string;
  authorization: string;
  body: string;
}

function fakeGranola(calls: Call[]) {
  return (async (input: Parameters<Fetch>[0], init?: Parameters<Fetch>[1]) => {
    const headers = new Headers(init?.headers);
    const body = typeof init?.body === 'string' ? init.body : '';
    const call = { url: String(input), authorization: headers.get('authorization') ?? '', body };
    calls.push(call);
    if (call.url === TOKEN_URL) return Response.json({ access_token: 'acceso-1', refresh_token: 'renueva-1', expires_in: 3600 });
    if (call.url !== MCP_URL) return new Response('{}', { status: 404 });
    if (call.authorization !== 'Bearer acceso-1') return new Response('{}', { status: 401 });
    const message = JSON.parse(body) as { id?: number; method: string; params?: { name?: string; arguments?: Record<string, unknown> } };
    if (message.method === 'initialize') return new Response(`event: message\ndata: ${JSON.stringify({ jsonrpc: '2.0', id: message.id, result: {} })}\n\n`, { headers: { 'content-type': 'text/event-stream', 'mcp-session-id': 'sesion-1' } });
    if (message.method === 'notifications/initialized') return new Response(null, { status: 202 });
    assert.equal(headers.get('mcp-session-id'), 'sesion-1');
    assert.equal(message.params?.name, 'search_meetings');
    return Response.json({ jsonrpc: '2.0', id: message.id, result: { content: [{ type: 'text', text: listing(null) }] } });
  }) as Fetch;
}

test('the listing Granola returns becomes one meeting per note, with its title decoded and no upcoming meetings', () => {
  const drafts = meetingsIn(listing(null));
  assert.deepEqual(drafts.map((draft) => [draft.externalId, draft.summary]), [
    ['note-1', 'Planificación & pagos · 2 asistentes'],
    ['note-2', 'Reunión sin título'],
  ]);
  assert.deepEqual(drafts[0]?.raw, {
    id: 'note-1',
    title: 'Planificación & pagos',
    web_url: 'https://notes.granola.ai/d/note-1',
    attendees: 2,
    organizer: 'tomas@example.com',
    calendar_event: { scheduled_start_time: today, scheduled_end_time: null },
  });
  assert.deepEqual(meetingsIn('Granola cambió el formato'), []);
});

test('Granola connects with one button: the server proves the code is its own, reads the meetings and never asks for a transcript', async () => {
  const calls: Call[] = [];
  const ctx = createContext({ location: ':memory:', model: null, whatsapp: null, fetch: fakeGranola(calls), config });
  const app = createApp(ctx);
  const { token } = ctx.store.addPerson('Ana');

  const started = await app.request(`/api/people/${token}/oauth/granola/start`, { headers: OWN_PAGE });
  assert.equal(started.status, 302);
  const location = new URL(started.headers.get('location') ?? '');
  assert.equal(`${location.origin}${location.pathname}`, 'https://mcp-auth.granola.ai/oauth2/authorize');
  assert.equal(location.searchParams.get('client_id'), 'grn-id');
  assert.equal(location.searchParams.get('redirect_uri'), 'https://ronda.test/api/oauth/granola/callback');
  assert.equal(location.searchParams.get('scope'), 'openid email profile offline_access');
  assert.equal(location.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(location.searchParams.get('resource'), MCP_URL);
  assert.ok(!location.search.includes('grn-secret'));

  const cookie = (started.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
  const state = location.searchParams.get('state') ?? '';
  const returned = await app.request(`/api/oauth/granola/callback?${new URLSearchParams({ code: 'codigo-1', state })}`, { headers: { cookie } });
  assert.equal(returned.status, 302);
  assert.equal(returned.headers.get('location'), `/conectar/${token}`);

  const exchange = new URLSearchParams(calls.find((call) => call.url === TOKEN_URL)?.body ?? '');
  assert.equal(exchange.get('code'), 'codigo-1');
  assert.equal(exchange.get('resource'), MCP_URL);
  assert.equal(createHash('sha256').update(exchange.get('code_verifier') ?? '').digest('base64url'), location.searchParams.get('code_challenge'));

  assert.equal(ctx.store.findConnection(token, 'granola')?.account, 'ana@example.com');
  assert.deepEqual(ctx.store.listEvents(token).map((event) => event.summary).sort(), ['Planificación & pagos · 2 asistentes', 'Reunión sin título']);
  assert.ok(calls.every((call) => !call.body.includes('transcript')));

  const page = await (await app.request(`/api/people/${token}`)).text();
  assert.ok(page.includes('"account":"ana@example.com"'));
  assert.ok(!page.includes('acceso-1') && !page.includes('renueva-1'));
});

test('a Granola meeting counts for today even without an end time', async () => {
  const ctx = createContext({ location: ':memory:', model: null, whatsapp: null, config });
  const app = createApp(ctx);
  const { token } = ctx.store.addPerson('Ana');
  for (const draft of meetingsIn(listing(null))) ctx.store.saveEvent(token, draft);
  const { signals } = (await (await app.request(`/api/people/${token}/signals`)).json()) as { signals: { load: { level: string; basis: string[] } } };
  assert.deepEqual(signals.load.basis, ['granola']);
});
