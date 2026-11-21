import type { DatabaseSync } from 'node:sqlite';

export const FACE_KINDS = ['capsula', 'ovalo', 'cuenta', 'almendra', 'huevo', 'arco'] as const;
export const FACE_SIZES = ['chica', 'media', 'grande'] as const;
export const FACE_GLASSES = ['redondo', 'suave', 'pantos', 'ceja'] as const;
export const FACE_BROWS = ['plana', 'arco', 'alzada'] as const;
export const FACE_MARKS = ['lunar', 'pecas'] as const;
export const FACE_TONES = 11;

export interface FaceLook {
  kind: (typeof FACE_KINDS)[number];
  size: (typeof FACE_SIZES)[number];
  glasses: (typeof FACE_GLASSES)[number] | null;
  brow: (typeof FACE_BROWS)[number] | null;
  mark: (typeof FACE_MARKS)[number] | null;
  lashes: boolean;
  tone: number;
}

export interface FaceStore {
  get(personToken: string): FaceLook | null;
  set(personToken: string, look: FaceLook | null): FaceLook | null;
  many(personTokens: string[]): Map<string, FaceLook>;
}

const oneOf = <Value extends string>(options: readonly Value[], value: unknown): value is Value => typeof value === 'string' && (options as readonly string[]).includes(value);
const optional = <Value extends string>(options: readonly Value[], value: unknown): Value | null | undefined => (value === null ? null : oneOf(options, value) ? value : undefined);

export function parseFaceLook(input: unknown): FaceLook | null | undefined {
  if (input === null) return null;
  if (!input || typeof input !== 'object') return undefined;
  const body = input as Record<string, unknown>;
  const glasses = optional(FACE_GLASSES, body.glasses);
  const brow = optional(FACE_BROWS, body.brow);
  const mark = optional(FACE_MARKS, body.mark);
  const tone = body.tone;
  if (!oneOf(FACE_KINDS, body.kind) || !oneOf(FACE_SIZES, body.size) || glasses === undefined || brow === undefined || mark === undefined) return undefined;
  if (typeof body.lashes !== 'boolean' || typeof tone !== 'number' || !Number.isInteger(tone) || tone < 0 || tone >= FACE_TONES) return undefined;
  return { kind: body.kind, size: body.size, glasses, brow, mark, lashes: body.lashes, tone };
}

export function openFaceStore(db: DatabaseSync): FaceStore {
  db.exec(`
    CREATE TABLE IF NOT EXISTS person_faces (
      person_token TEXT PRIMARY KEY REFERENCES people (token),
      look TEXT NOT NULL
    );
  `);

  const read = (raw: string): FaceLook | null => {
    try {
      return parseFaceLook(JSON.parse(raw)) ?? null;
    } catch {
      return null;
    }
  };

  return {
    get(personToken) {
      const row = db.prepare('SELECT look FROM person_faces WHERE person_token = ?').get(personToken) as { look: string } | undefined;
      return row ? read(row.look) : null;
    },
    set(personToken, look) {
      if (!look) {
        db.prepare('DELETE FROM person_faces WHERE person_token = ?').run(personToken);
        return null;
      }
      db.prepare('INSERT INTO person_faces (person_token, look) VALUES (?, ?) ON CONFLICT (person_token) DO UPDATE SET look = excluded.look').run(personToken, JSON.stringify(look));
      return look;
    },
    many(personTokens) {
      const found = new Map<string, FaceLook>();
      if (personTokens.length === 0) return found;
      const rows = db.prepare(`SELECT person_token, look FROM person_faces WHERE person_token IN (${personTokens.map(() => '?').join(', ')})`).all(...personTokens) as { person_token: string; look: string }[];
      for (const row of rows) {
        const look = read(row.look);
        if (look) found.set(row.person_token, look);
      }
      return found;
    },
  };
}
