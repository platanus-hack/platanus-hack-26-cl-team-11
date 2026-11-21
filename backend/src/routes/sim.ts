import { Hono } from 'hono';
import { AgentModelError } from '../agents/model.js';
import type { AppContext } from '../context.js';
import { rateLimit } from '../rateLimit.js';
import { clampPeople, populateRoom, startSimRound } from '../sim/run.js';
import { asObject } from './shared.js';

const ROOM_NOT_FOUND = { error: 'Esa sala no existe.' } as const;
const NOT_CONFIGURED = { error: 'Faltan las credenciales del modelo en el servidor.' } as const;
const ROUND_RUNNING = { error: 'Ya hay una ronda en curso en esta sala.' } as const;
const SIMULATIONS_PER_MINUTE = 6;

export function simRoutes(ctx: AppContext) {
  const routes = new Hono();
  const limited = rateLimit(SIMULATIONS_PER_MINUTE);
  const filling = new Set<string>();

  routes.post('/rooms/:code/simulate', limited, async (c) => {
    const room = ctx.rooms.findRoom(c.req.param('code'));
    if (!room) return c.json(ROOM_NOT_FOUND, 404);
    if (!ctx.model) return c.json(NOT_CONFIGURED, 503);
    if (filling.has(room.code) || ctx.agents.latestRound(room.teamId)?.status === 'en_curso') return c.json(ROUND_RUNNING, 409);
    const wanted = clampPeople(asObject(await c.req.text()).people);
    let added: number;
    filling.add(room.code);
    try {
      added = await populateRoom(ctx, ctx.model, room, wanted);
    } catch (failure) {
      if (failure instanceof AgentModelError) return c.json({ error: failure.message }, 502);
      throw failure;
    } finally {
      filling.delete(room.code);
    }
    const started = startSimRound(ctx, ctx.model, room);
    if (!started) return c.json(ROUND_RUNNING, 409);
    void started.done;
    return c.json({ people: added, round: { id: started.round.id, status: started.round.status } }, 202);
  });

  return routes;
}
