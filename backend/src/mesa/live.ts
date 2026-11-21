import type { LiveText } from '../agents/round.js';

export interface LiveTexts {
  put(text: LiveText): void;
  all(): LiveText[];
  clear(): void;
}

export function createLiveTexts(): LiveTexts {
  const texts = new Map<string, LiveText>();
  return {
    put: (text) => void texts.set(text.key, text),
    all: () => [...texts.values()],
    clear: () => texts.clear(),
  };
}
