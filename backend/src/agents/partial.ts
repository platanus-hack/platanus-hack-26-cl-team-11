const ESCAPED: Record<string, string> = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f' };
const UNICODE_DIGITS = 4;
const BLANK = /\s/;

export interface PartialString {
  text: string;
  closed: boolean;
}

export function partialString(raw: string, field: string): PartialString | null {
  const key = raw.indexOf(`"${field}"`);
  if (key < 0) return null;
  let at = key + field.length + 2;
  while (at < raw.length && BLANK.test(raw[at] as string)) at += 1;
  if (raw[at] !== ':') return null;
  at += 1;
  while (at < raw.length && BLANK.test(raw[at] as string)) at += 1;
  if (raw[at] !== '"') return null;
  at += 1;

  let text = '';
  while (at < raw.length) {
    const char = raw[at] as string;
    if (char === '"') return { text, closed: true };
    if (char !== '\\') {
      text += char;
      at += 1;
      continue;
    }
    const next = raw[at + 1];
    if (next === undefined) break;
    if (next === 'u') {
      const digits = raw.slice(at + 2, at + 2 + UNICODE_DIGITS);
      if (digits.length < UNICODE_DIGITS) break;
      text += String.fromCharCode(Number.parseInt(digits, 16));
      at += 2 + UNICODE_DIGITS;
      continue;
    }
    text += ESCAPED[next] ?? next;
    at += 2;
  }
  return { text, closed: false };
}

export function partialContacts(raw: string): Array<{ teammate: string; message: string }> {
  const list = raw.indexOf('"contacts"');
  if (list < 0) return [];
  return raw
    .slice(list)
    .split('{')
    .slice(1)
    .flatMap((piece) => {
      const teammate = partialString(piece, 'teammate');
      const message = partialString(piece, 'message');
      return teammate?.closed && message?.text ? [{ teammate: teammate.text, message: message.text }] : [];
    });
}
