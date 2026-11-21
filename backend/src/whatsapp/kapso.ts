import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Fetch } from '../types.js';

const KAPSO_API = 'https://api.kapso.ai';
const MESSAGES_PATH = '/meta/whatsapp/v24.0';
const PHONE_NUMBERS_PATH = '/platform/v1/whatsapp/phone_numbers';
const REQUEST_TIMEOUT_MS = 15_000;
const MESSAGE_IN_FLIGHT = 409;
const RETRY_AFTER_MS = 1200;
const LOGGED_BODY_CHARS = 300;

export const MAX_BUTTONS = 3;
export const MAX_BUTTON_TITLE_LENGTH = 20;
export const MAX_BUTTON_BODY_LENGTH = 1024;
export const MAX_TEXT_LENGTH = 4000;

export interface KapsoConfig {
  apiKey: string;
  phoneNumberId: string;
  webhookSecret: string;
  number: string | null;
}

export interface ReplyButton {
  id: string;
  title: string;
}

export interface WhatsAppChannel {
  phoneNumberId: string;
  sendText(to: string, body: string): Promise<boolean>;
  sendButtons(to: string, body: string, buttons: ReplyButton[]): Promise<boolean>;
  number(): Promise<string | null>;
  isSigned(rawBody: string, signature: string | undefined): boolean;
}

export const digitsOf = (value: unknown): string => (typeof value === 'string' ? value.replace(/\D/g, '') : '');

export function kapsoConfigFrom(env: NodeJS.ProcessEnv): KapsoConfig | null {
  const apiKey = env.KAPSO_API_KEY;
  const phoneNumberId = env.KAPSO_PHONE_NUMBER_ID;
  const webhookSecret = env.KAPSO_WEBHOOK_SECRET;
  if (!apiKey || !phoneNumberId || !webhookSecret) return null;
  return { apiKey, phoneNumberId, webhookSecret, number: digitsOf(env.KAPSO_WHATSAPP_NUMBER) || null };
}

export function isSignedBy(secret: string, rawBody: string, signature: string | undefined): boolean {
  if (!signature) return false;
  const expected = Buffer.from(createHmac('sha256', secret).update(rawBody).digest('hex'));
  const received = Buffer.from(signature.trim().toLowerCase());
  return expected.length === received.length && timingSafeEqual(expected, received);
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function createKapsoChannel(config: KapsoConfig, fetchImpl: Fetch = fetch, retryAfterMs: number = RETRY_AFTER_MS): WhatsAppChannel {
  const headers = { 'x-api-key': config.apiKey, 'content-type': 'application/json' };
  const queues = new Map<string, Promise<boolean>>();
  let knownNumber = config.number;

  const post = (message: Record<string, unknown>) =>
    fetchImpl(`${KAPSO_API}${MESSAGES_PATH}/${config.phoneNumberId}/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ messaging_product: 'whatsapp', ...message }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

  const deliver = async (message: Record<string, unknown>): Promise<boolean> => {
    try {
      let response = await post(message);
      if (response.status === MESSAGE_IN_FLIGHT) {
        await wait(retryAfterMs);
        response = await post(message);
      }
      if (response.ok) return true;
      console.error('Kapso did not accept a WhatsApp message.', response.status, (await response.text().catch(() => '')).slice(0, LOGGED_BODY_CHARS));
      return false;
    } catch (failure) {
      console.error('Kapso could not be reached.', failure instanceof Error ? failure.name : failure);
      return false;
    }
  };

  const inOrder = (to: string, message: Record<string, unknown>): Promise<boolean> => {
    const previous = queues.get(to) ?? Promise.resolve(true);
    const next = previous.then(() => deliver({ to, ...message }));
    queues.set(to, next);
    void next.finally(() => {
      if (queues.get(to) === next) queues.delete(to);
    });
    return next;
  };

  return {
    phoneNumberId: config.phoneNumberId,

    sendText: (to, body) => inOrder(to, { type: 'text', text: { body: body.slice(0, MAX_TEXT_LENGTH) } }),

    sendButtons: (to, body, buttons) =>
      inOrder(to, {
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: body.slice(0, MAX_BUTTON_BODY_LENGTH) },
          action: {
            buttons: buttons.slice(0, MAX_BUTTONS).map((button) => ({ type: 'reply', reply: { id: button.id, title: button.title.slice(0, MAX_BUTTON_TITLE_LENGTH) } })),
          },
        },
      }),

    async number() {
      if (knownNumber) return knownNumber;
      try {
        const response = await fetchImpl(`${KAPSO_API}${PHONE_NUMBERS_PATH}?phone_number_id=${encodeURIComponent(config.phoneNumberId)}`, {
          headers,
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (!response.ok) return null;
        const body = (await response.json().catch(() => null)) as { data?: Array<{ display_phone_number_normalized?: unknown; display_phone_number?: unknown }> } | null;
        const found = body?.data?.[0];
        knownNumber = digitsOf(found?.display_phone_number_normalized) || digitsOf(found?.display_phone_number) || null;
        return knownNumber;
      } catch {
        return null;
      }
    },

    isSigned: (rawBody, signature) => isSignedBy(config.webhookSecret, rawBody, signature),
  };
}
