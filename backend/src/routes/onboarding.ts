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

export function onboardingRoutes({ store, teams, assistants, repo, whatsapp }: AppContext) {
  const routes = new Hono();

  routes.get('/people/:token/onboarding', (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json(NOT_FOUND, 404);
    const received = store.syncBySource(person.token);
    const has = (source: string) => (received[source]?.total ?? 0) > 0;
    const phone = whatsapp.statusOf(person.token);
    const steps: OnboardingStep[] = [
      { id: 'equipo', done: teams.teamsOf(person.token).length > 0 },
      { id: 'agente', done: assistants.assistantsOf(person.token).length > 0 || repo.tree(person.token).length > 0 },
      { id: 'checkin', done: has(CHECKIN_SOURCE) },
      ...(phone.configured ? [{ id: 'whatsapp' as const, done: phone.linked }] : []),
      { id: 'salud', done: has(HEALTH_SOURCE) },
    ];
    return c.json({ steps, pending: steps.filter((step) => !step.done).length });
  });

  return routes;
}
