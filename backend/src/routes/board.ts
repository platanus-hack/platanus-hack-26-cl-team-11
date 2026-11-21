import { Hono } from 'hono';
import {
  isPostKind,
  isPostStatus,
  isVoteValue,
  MAX_TEXT_LENGTH,
  openBoardStore,
  type BoardPost,
  type BoardReply,
} from '../board/store.js';
import type { AppContext } from '../context.js';
import { asObject, NOT_FOUND } from './shared.js';

const NOT_A_MEMBER = { error: 'No perteneces a ese equipo.' } as const;
const POST_NOT_FOUND = { error: 'Esa publicación no existe.' } as const;
const POST_CLOSED = { error: 'Esa publicación ya está cerrada.' } as const;
const NOT_THE_AUTHOR = { error: 'Solo quien publicó puede cerrarla.' } as const;
const INVALID_KIND = { error: 'El tipo debe ser pregunta, pedido o propuesta.' } as const;
const INVALID_STATUS = { error: 'El estado debe ser abierto o cerrado.' } as const;
const INVALID_VOTE = { error: 'El voto debe ser a_favor o en_contra.' } as const;
const INVALID_TELLABLE = { error: 'El permiso para contar debe ser verdadero o falso.' } as const;
const NOT_A_PROPOSAL = { error: 'Solo se vota en una propuesta.' } as const;
const MISSING_TEXT = { error: 'Falta el texto.' } as const;
const TEXT_TOO_LONG = { error: `El texto no puede superar los ${MAX_TEXT_LENGTH} caracteres.` } as const;

const trimmedText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const textProblem = (text: string) => (!text ? MISSING_TEXT : text.length > MAX_TEXT_LENGTH ? TEXT_TOO_LONG : null);

export function boardRoutes({ db, store, teams }: AppContext) {
  const routes = new Hono();
  const board = openBoardStore(db);

  const memberTokensOf = (teamId: string) => new Set(teams.membersOf(teamId).map((member) => member.token));

  const tallyOf = (post: BoardPost, viewerToken: string, memberTokens: Set<string>) => {
    const votes = board.votesOf(post.id).filter((vote) => memberTokens.has(vote.voterToken));
    return {
      tally: {
        aFavor: votes.filter((vote) => vote.value === 'a_favor').length,
        enContra: votes.filter((vote) => vote.value === 'en_contra').length,
        total: memberTokens.size,
      },
      myVote: votes.find((vote) => vote.voterToken === viewerToken)?.value ?? null,
    };
  };

  const viewReply = (reply: BoardReply, post: BoardPost, viewerToken: string) => ({
    id: reply.id,
    postId: reply.postId,
    authorName: reply.authorName,
    text: reply.tellable || viewerToken === post.authorToken || viewerToken === reply.authorToken ? reply.text : null,
    createdAt: reply.createdAt,
    tellable: reply.tellable,
    mine: viewerToken === reply.authorToken,
  });

  const viewPost = (post: BoardPost, viewerToken: string, memberTokens: Set<string>) => ({
    id: post.id,
    teamId: post.teamId,
    authorName: post.authorName,
    kind: post.kind,
    text: post.text,
    createdAt: post.createdAt,
    status: post.status,
    mine: viewerToken === post.authorToken,
    replies: board.repliesOf(post.id).map((reply) => viewReply(reply, post, viewerToken)),
    ...(post.kind === 'propuesta' ? tallyOf(post, viewerToken, memberTokens) : { tally: null, myVote: null }),
  });

  routes.post('/people/:token/teams/:teamId/board', async (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json(NOT_FOUND, 404);
    const teamId = c.req.param('teamId');
    if (!teams.isMember(teamId, person.token)) return c.json(NOT_A_MEMBER, 403);
    const body = asObject(await c.req.text());
    if (!isPostKind(body.kind)) return c.json(INVALID_KIND, 400);
    const text = trimmedText(body.text);
    const problem = textProblem(text);
    if (problem) return c.json(problem, 400);
    const post = board.createPost({ teamId, authorToken: person.token, kind: body.kind, text });
    return c.json(viewPost(post, person.token, memberTokensOf(teamId)), 201);
  });

  routes.get('/people/:token/teams/:teamId/board', (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json(NOT_FOUND, 404);
    const teamId = c.req.param('teamId');
    if (!teams.isMember(teamId, person.token)) return c.json(NOT_A_MEMBER, 403);
    const status = c.req.query('status');
    if (status !== undefined && !isPostStatus(status)) return c.json(INVALID_STATUS, 400);
    const memberTokens = memberTokensOf(teamId);
    return c.json({ posts: board.postsOf(teamId, status).map((post) => viewPost(post, person.token, memberTokens)) });
  });

  routes.post('/people/:token/board/:postId/replies', async (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json(NOT_FOUND, 404);
    const post = board.findPost(c.req.param('postId'));
    if (!post) return c.json(POST_NOT_FOUND, 404);
    if (!teams.isMember(post.teamId, person.token)) return c.json(NOT_A_MEMBER, 403);
    const body = asObject(await c.req.text());
    const text = trimmedText(body.text);
    const problem = textProblem(text);
    if (problem) return c.json(problem, 400);
    if (body.tellable !== undefined && typeof body.tellable !== 'boolean') return c.json(INVALID_TELLABLE, 400);
    if (post.status === 'cerrado') return c.json(POST_CLOSED, 409);
    const reply = board.addReply({ postId: post.id, authorToken: person.token, text, tellable: body.tellable === true });
    return c.json(viewReply(reply, post, person.token), 201);
  });

  routes.post('/people/:token/board/:postId/votes', async (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json(NOT_FOUND, 404);
    const post = board.findPost(c.req.param('postId'));
    if (!post) return c.json(POST_NOT_FOUND, 404);
    if (!teams.isMember(post.teamId, person.token)) return c.json(NOT_A_MEMBER, 403);
    if (post.kind !== 'propuesta') return c.json(NOT_A_PROPOSAL, 400);
    const body = asObject(await c.req.text());
    if (!isVoteValue(body.value)) return c.json(INVALID_VOTE, 400);
    if (post.status === 'cerrado') return c.json(POST_CLOSED, 409);
    board.castVote(post.id, person.token, body.value);
    const { tally, myVote } = tallyOf(post, person.token, memberTokensOf(post.teamId));
    return c.json({ ...tally, myVote });
  });

  routes.post('/people/:token/board/:postId/close', (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json(NOT_FOUND, 404);
    const post = board.findPost(c.req.param('postId'));
    if (!post) return c.json(POST_NOT_FOUND, 404);
    if (!teams.isMember(post.teamId, person.token)) return c.json(NOT_A_MEMBER, 403);
    if (post.authorToken !== person.token) return c.json(NOT_THE_AUTHOR, 403);
    board.closePost(post.id);
    return c.json(viewPost({ ...post, status: 'cerrado' }, person.token, memberTokensOf(post.teamId)));
  });

  return routes;
}
