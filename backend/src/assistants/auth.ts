import type { Assistant, AssistantStore } from './store.js';

const BEARER = /^Bearer\s+(\S+)$/i;

export const INVALID_ASSISTANT = { error: 'Token de asistente no válido o revocado. Pide un link nuevo a tu persona.' } as const;

export const assistantFrom = (assistants: AssistantStore, authorization: string | undefined): Assistant | undefined => {
  const token = authorization ? BEARER.exec(authorization)?.[1] : undefined;
  return token ? assistants.authenticate(token) : undefined;
};
