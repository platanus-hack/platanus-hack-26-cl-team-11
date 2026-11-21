import type { JsonObject } from '../types.js';

export const NOT_FOUND = { error: 'Link no válido.' } as const;

export const asObject = (text: string): JsonObject => {
  if (!text.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as JsonObject) : { value: parsed };
  } catch {
    return { unparsed_text: text };
  }
};
