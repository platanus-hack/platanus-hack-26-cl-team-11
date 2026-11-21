import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { openBoardStore } from '../src/board/store.js';
import { createContext } from '../src/context.js';
import { boardRoutes } from '../src/routes/board.js';

interface Tally {
  aFavor: number;
  enContra: number;
  total: number;
}

interface ReplyView {
  id: string;
  authorName: string;
  text: string | null;
  createdAt: string;
  tellable: boolean;
  mine: boolean;
}

interface PostView {
  id: string;
  teamId: string;
  authorName: string;
  kind: string;
  text: string;
  createdAt: string;
  status: string;
  mine: boolean;
  replies: ReplyView[];
  tally: Tally | null;
  myVote: string | null;
}

const post = (body: unknown) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

function setup() {
  const ctx = createContext({ location: ':memory:', model: null });
  const app = new Hono().route('/api', boardRoutes(ctx));
  const ana = ctx.store.addPerson('Ana');
  const tomas = ctx.store.addPerson('Tomás');
  const lia = ctx.store.addPerson('Lía');
  const outsider = ctx.store.addPerson('Bruno');
  const team = ctx.teams.createTeam('Producto');
  for (const member of [ana, tomas, lia]) ctx.teams.addMember(team.id, member.token);
  const tokens = [ana, tomas, lia, outsider].map((person) => person.token);
  const bodies: string[] = [];

  const call = async <Body = { error?: string }>(path: string, init?: RequestInit) => {
    const response = await app.request(`/api${path}`, init);
    const text = await response.text();
    bodies.push(text);
    return { status: response.status, body: JSON.parse(text) as Body };
  };

  const publish = async (authorToken: string, kind: string, text: string) =>
    (await call<PostView>(`/people/${authorToken}/teams/${team.id}/board`, post({ kind, text }))).body;

  const boardOf = async (viewerToken: string, query = '') =>
    (await call<{ posts: PostView[] }>(`/people/${viewerToken}/teams/${team.id}/board${query}`)).body.posts;

  const assertNoTokens = () => {
    assert.ok(bodies.length > 0);
    for (const body of bodies) for (const token of tokens) assert.ok(!body.includes(token));
  };

  return { ctx, ana, tomas, lia, outsider, team, call, publish, boardOf, assertNoTokens };
}

test('a member publishes and the team reads the board newest first without any token', async () => {
  const { ana, tomas, team, call, publish, boardOf, assertNoTokens } = setup();

  const created = await call<PostView>(`/people/${ana.token}/teams/${team.id}/board`, post({ kind: 'pregunta', text: '  ¿Quién conoce el flujo de pagos?  ' }));
  assert.equal(created.status, 201);
  assert.equal(created.body.teamId, team.id);
  assert.equal(created.body.authorName, 'Ana');
  assert.equal(created.body.kind, 'pregunta');
  assert.equal(created.body.text, '¿Quién conoce el flujo de pagos?');
  assert.equal(created.body.status, 'abierto');
  assert.equal(created.body.mine, true);
  assert.deepEqual(created.body.replies, []);
  assert.equal(created.body.tally, null);
  assert.ok(!Number.isNaN(Date.parse(created.body.createdAt)));

  const request = await publish(tomas.token, 'pedido', 'Busco a alguien con experiencia en facturación');
  const posts = await boardOf(tomas.token);
  assert.deepEqual(posts.map((item) => item.id), [request.id, created.body.id]);
  assert.deepEqual(posts.map((item) => item.authorName), ['Tomás', 'Ana']);
  assert.deepEqual(posts.map((item) => item.mine), [true, false]);
  assertNoTokens();
});

test('every board route rejects an unknown link and a person outside the team', async () => {
  const { ana, outsider, team, call, publish, assertNoTokens } = setup();
  const proposal = await publish(ana.token, 'propuesta', 'Reuniones sin cámara los viernes');

  const attempts = (token: string): Array<[string, RequestInit | undefined]> => [
    [`/people/${token}/teams/${team.id}/board`, post({ kind: 'pregunta', text: 'Hola' })],
    [`/people/${token}/teams/${team.id}/board`, undefined],
    [`/people/${token}/board/${proposal.id}/replies`, post({ text: 'Hola' })],
    [`/people/${token}/board/${proposal.id}/votes`, post({ value: 'a_favor' })],
    [`/people/${token}/board/${proposal.id}/close`, { method: 'POST' }],
  ];

  for (const [path, init] of attempts('nope')) {
    const response = await call(path, init);
    assert.equal(response.status, 404);
    assert.deepEqual(response.body, { error: 'Link no válido.' });
  }

  for (const [path, init] of attempts(outsider.token)) {
    const response = await call(path, init);
    assert.equal(response.status, 403);
    assert.deepEqual(response.body, { error: 'No perteneces a ese equipo.' });
  }

  assert.equal((await call(`/people/${ana.token}/teams/team_nope/board`)).status, 403);
  for (const action of ['replies', 'votes', 'close']) {
    assert.equal((await call(`/people/${ana.token}/board/post_nope/${action}`, post({ text: 'Hola', value: 'a_favor' }))).status, 404);
  }

  const posts = (await call<{ posts: PostView[] }>(`/people/${ana.token}/teams/${team.id}/board`)).body.posts;
  assert.equal(posts.length, 1);
  assert.deepEqual(posts[0]?.replies, []);
  assert.deepEqual(posts[0]?.tally, { aFavor: 0, enContra: 0, total: 3 });
  assert.equal(posts[0]?.status, 'abierto');
  assertNoTokens();
});

test('kinds, statuses, votes and texts outside the contract are rejected', async () => {
  const { ana, tomas, team, call, publish, boardOf, assertNoTokens } = setup();
  const boardPath = `/people/${ana.token}/teams/${team.id}/board`;

  assert.equal((await call(boardPath, post({ kind: 'anuncio', text: 'Hola' }))).status, 400);
  assert.equal((await call(boardPath, post({ text: 'Hola' }))).status, 400);
  assert.equal((await call(boardPath, post({ kind: 'pregunta' }))).status, 400);
  assert.equal((await call(boardPath, post({ kind: 'pregunta', text: '   ' }))).status, 400);
  assert.equal((await call(boardPath, post({ kind: 'pregunta', text: 42 }))).status, 400);
  assert.equal((await call(boardPath, post({ kind: 'pregunta', text: 'a'.repeat(501) }))).status, 400);
  assert.equal((await call(boardPath, post({ kind: 'pregunta', text: 'a'.repeat(500) }))).status, 201);
  assert.equal((await call(`${boardPath}?status=archivado`)).status, 400);

  const question = (await boardOf(ana.token))[0];
  assert.ok(question);
  const proposal = await publish(ana.token, 'propuesta', 'Un día sin reuniones');

  assert.equal((await call(`/people/${tomas.token}/board/${question.id}/votes`, post({ value: 'a_favor' }))).status, 400);
  assert.equal((await call(`/people/${tomas.token}/board/${proposal.id}/votes`, post({ value: 'abstencion' }))).status, 400);
  assert.equal((await call(`/people/${tomas.token}/board/${proposal.id}/votes`, post({}))).status, 400);
  assert.equal((await call(`/people/${tomas.token}/board/${proposal.id}/replies`, post({ text: '' }))).status, 400);
  assert.equal((await call(`/people/${tomas.token}/board/${proposal.id}/replies`, post({ text: 'a'.repeat(501) }))).status, 400);
  assert.equal((await call(`/people/${tomas.token}/board/${proposal.id}/replies`, post({ text: 'Hola', tellable: 'si' }))).status, 400);

  const posts = await boardOf(ana.token);
  assert.equal(posts.length, 2);
  assert.deepEqual(posts[0]?.tally, { aFavor: 0, enContra: 0, total: 3 });
  assert.deepEqual(posts.flatMap((item) => item.replies), []);
  assertNoTokens();
});

test('a reply that is not tellable shows its text only to the post author and the replier', async () => {
  const { ana, tomas, lia, team, call, publish, boardOf, assertNoTokens } = setup();
  const request = await publish(ana.token, 'pedido', 'Busco ayuda con el cierre de mes');

  const reserved = await call<ReplyView>(`/people/${tomas.token}/board/${request.id}/replies`, post({ text: 'Sabe del tema, pero esta semana no puede' }));
  assert.equal(reserved.status, 201);
  assert.equal(reserved.body.tellable, false);
  assert.equal(reserved.body.text, 'Sabe del tema, pero esta semana no puede');
  assert.equal(reserved.body.authorName, 'Tomás');

  const open = await call<ReplyView>(`/people/${lia.token}/board/${request.id}/replies`, post({ text: 'Puede ayudar el jueves', tellable: true }));
  assert.equal(open.status, 201);
  assert.equal(open.body.tellable, true);

  const repliesSeenBy = async (viewerToken: string) => (await boardOf(viewerToken))[0]?.replies ?? [];

  const forAuthor = await repliesSeenBy(ana.token);
  assert.deepEqual(forAuthor.map((reply) => reply.text), ['Sabe del tema, pero esta semana no puede', 'Puede ayudar el jueves']);

  const forReplier = await repliesSeenBy(tomas.token);
  assert.deepEqual(forReplier.map((reply) => reply.text), ['Sabe del tema, pero esta semana no puede', 'Puede ayudar el jueves']);
  assert.deepEqual(forReplier.map((reply) => reply.mine), [true, false]);

  const forBystander = await repliesSeenBy(lia.token);
  assert.deepEqual(forBystander.map((reply) => reply.text), [null, 'Puede ayudar el jueves']);
  assert.equal(forBystander[0]?.authorName, 'Tomás');
  assert.equal(forBystander[0]?.createdAt, reserved.body.createdAt);
  assert.equal(forBystander[0]?.tellable, false);

  const bystanderBoard = await call(`/people/${lia.token}/teams/${team.id}/board`);
  assert.ok(!JSON.stringify(bystanderBoard.body).includes('esta semana no puede'));
  assertNoTokens();
});

test('each person has one vote on a proposal and can change it', async () => {
  const { ctx, ana, tomas, lia, outsider, team, call, publish, boardOf, assertNoTokens } = setup();
  const proposal = await publish(ana.token, 'propuesta', 'Cerrar la semana con una demo');
  const votePath = (token: string) => `/people/${token}/board/${proposal.id}/votes`;

  const first = await call<Tally & { myVote: string }>(votePath(tomas.token), post({ value: 'a_favor' }));
  assert.equal(first.status, 200);
  assert.deepEqual(first.body, { aFavor: 1, enContra: 0, total: 3, myVote: 'a_favor' });

  const repeated = await call<Tally & { myVote: string }>(votePath(tomas.token), post({ value: 'a_favor' }));
  assert.deepEqual(repeated.body, { aFavor: 1, enContra: 0, total: 3, myVote: 'a_favor' });

  const changed = await call<Tally & { myVote: string }>(votePath(tomas.token), post({ value: 'en_contra' }));
  assert.deepEqual(changed.body, { aFavor: 0, enContra: 1, total: 3, myVote: 'en_contra' });

  const second = await call<Tally & { myVote: string }>(votePath(lia.token), post({ value: 'a_favor' }));
  assert.deepEqual(second.body, { aFavor: 1, enContra: 1, total: 3, myVote: 'a_favor' });
  assert.equal(openBoardStore(ctx.db).votesOf(proposal.id).length, 2);

  const seenByTomas = (await boardOf(tomas.token))[0];
  assert.deepEqual(seenByTomas?.tally, { aFavor: 1, enContra: 1, total: 3 });
  assert.equal(seenByTomas?.myVote, 'en_contra');
  assert.equal((await boardOf(ana.token))[0]?.myVote, null);

  ctx.teams.addMember(team.id, outsider.token);
  ctx.teams.removeMember(team.id, lia.token);
  assert.deepEqual((await boardOf(ana.token))[0]?.tally, { aFavor: 0, enContra: 1, total: 3 });
  assertNoTokens();
});

test('only the author closes a post, and a closed post takes no more replies or votes', async () => {
  const { ana, tomas, call, publish, boardOf, assertNoTokens } = setup();
  const proposal = await publish(ana.token, 'propuesta', 'Rotar quién toma notas');
  const question = await publish(tomas.token, 'pregunta', '¿Quién revisa el despliegue?');

  const refused = await call(`/people/${tomas.token}/board/${proposal.id}/close`, { method: 'POST' });
  assert.equal(refused.status, 403);
  assert.deepEqual(refused.body, { error: 'Solo quien publicó puede cerrarla.' });
  assert.equal((await boardOf(ana.token, '?status=cerrado')).length, 0);

  const closed = await call<PostView>(`/people/${ana.token}/board/${proposal.id}/close`, { method: 'POST' });
  assert.equal(closed.status, 200);
  assert.equal(closed.body.status, 'cerrado');
  assert.equal((await call(`/people/${ana.token}/board/${proposal.id}/close`, { method: 'POST' })).status, 200);

  assert.deepEqual((await boardOf(tomas.token, '?status=abierto')).map((item) => item.id), [question.id]);
  assert.deepEqual((await boardOf(tomas.token, '?status=cerrado')).map((item) => item.id), [proposal.id]);
  assert.deepEqual((await boardOf(tomas.token)).map((item) => item.id), [question.id, proposal.id]);

  assert.equal((await call(`/people/${tomas.token}/board/${proposal.id}/replies`, post({ text: 'Llego tarde' }))).status, 409);
  assert.equal((await call(`/people/${tomas.token}/board/${proposal.id}/votes`, post({ value: 'a_favor' }))).status, 409);
  assertNoTokens();
});
