import { Hono } from 'hono';
import { CHECKIN_SOURCE } from '../checkins.js';
import type { AppContext } from '../context.js';
import { NOT_FOUND } from './shared.js';

const HEALTH_SOURCE = 'apple_health';

export type OnboardingStepId = 'equipo' | 'agente' | 'checkin' | 'whatsapp' | 'salud';

interface OnboardingStep {
  id: OnboardingStepId;
  done: boolean;
}

export function onboardingStepsOf({ store, teams, assistants, repo, whatsapp }: AppContext, personToken: string): OnboardingStep[] {
  const received = store.syncBySource(personToken);
  const has = (source: string) => (received[source]?.total ?? 0) > 0;
  const phone = whatsapp.statusOf(personToken);
  return [
    { id: 'equipo', done: teams.teamsOf(personToken).length > 0 },
    { id: 'agente', done: assistants.assistantsOf(personToken).length > 0 || repo.tree(personToken).length > 0 },
    { id: 'checkin', done: has(CHECKIN_SOURCE) },
    ...(phone.configured ? [{ id: 'whatsapp' as const, done: phone.linked }] : []),
    { id: 'salud', done: has(HEALTH_SOURCE) },
  ];
}

export function onboardingRoutes(ctx: AppContext) {
  const routes = new Hono();

  routes.get('/people/:token/onboarding', (c) => {
    const person = ctx.store.findPerson(c.req.param('token'));
    if (!person) return c.json(NOT_FOUND, 404);
    const steps = onboardingStepsOf(ctx, person.token);
    const welcome = steps.every((step) => !step.done) && ctx.store.listConnections(person.token).length === 0;
    return c.json({ steps, pending: steps.filter((step) => !step.done).length, welcome });
  });

  return routes;
}
