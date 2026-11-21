import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { HTTPException } from 'hono/http-exception';

export const FIVE_MINUTES = 300_000;
export const GRACE = 45_000;
export const STAKE = 10;
export type Team = { id: string; name: string; price: number };
export type Tape = { ts: number; open: boolean; teams: Team[] };
interface Order {
  id: string;
  maker: string;
  taker: string | null;
  a: string;
  b: string;
  state: string;
  offered: number;
  due: number;
  startA: number;
  startB: number;
  endA: number | null;
  endB: number | null;
  verdict: string | null;
}
export function reject(message: string): never {
  throw new HTTPException(409, { message });
}

export function createGame(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS duel_wallet (id TEXT PRIMARY KEY, name TEXT NOT NULL, points INTEGER NOT NULL DEFAULT 100 CHECK(points>=0));
    CREATE TABLE IF NOT EXISTS duel_order (
      id TEXT PRIMARY KEY, maker TEXT NOT NULL REFERENCES duel_wallet, taker TEXT REFERENCES duel_wallet,
      nonce TEXT NOT NULL, a TEXT NOT NULL, b TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'open',
      offered INTEGER NOT NULL, due INTEGER NOT NULL, startA REAL, startB REAL, endA REAL, endB REAL, verdict TEXT,
      UNIQUE(maker,nonce));
    CREATE INDEX IF NOT EXISTS duel_due ON duel_order(state,due);
  `);
  function atomic<T>(work: () => T): T {
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = work();
      db.exec('COMMIT');
      return result;
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }
  const wallet = (id: string) =>
    db.prepare('SELECT name,points FROM duel_wallet WHERE id=?').get(id) as { name: string; points: number } | undefined;
  function charge(id: string) {
    if (!db.prepare('UPDATE duel_wallet SET points=points-? WHERE id=? AND points>=?').run(STAKE, id, STAKE).changes)
      reject('Necesitas 10 fichas disponibles.');
  }
  const credit = (id: string, n: number) => db.prepare('UPDATE duel_wallet SET points=points+? WHERE id=?').run(n, id);
  const get = (id: string) => db.prepare('SELECT * FROM duel_order WHERE id=?').get(id) as unknown as Order | undefined;
  function finish(o: Order, verdict: string, a: number | null = null, b: number | null = null) {
    db.prepare("UPDATE duel_order SET state='done',verdict=?,endA=?,endB=? WHERE id=?").run(verdict, a, b, o.id);
    if (verdict === 'a') credit(o.maker, STAKE * 2);
    else if (verdict === 'b' && o.taker) credit(o.taker, STAKE * 2);
    else {
      credit(o.maker, STAKE);
      if (o.taker) credit(o.taker, STAKE);
    }
  }
  return {
    wallet,
    register(id: string, name: string) {
      db.prepare('INSERT INTO duel_wallet(id,name) VALUES(?,?) ON CONFLICT(id) DO NOTHING').run(id, name);
      return wallet(id);
    },
    active() {
      return !!db.prepare("SELECT 1 FROM duel_order WHERE state IN ('open','live') LIMIT 1").get();
    },
    place(id: string, nonce: string, a: string, b: string, t: Tape, now: number) {
      return atomic(() => {
        const prior = db.prepare('SELECT id,a,b FROM duel_order WHERE maker=? AND nonce=?').get(id, nonce);
        if (prior && (prior.a !== a || prior.b !== b)) reject('Esa orden ya se usó para otro duelo.');
        if (prior) return String(prior.id);
        if (!t.open || a === b || !t.teams.some((p) => p.id === a) || !t.teams.some((p) => p.id === b))
          reject('Elige dos equipos disponibles.');
        charge(id);
        const key = randomUUID();
        db.prepare('INSERT INTO duel_order(id,maker,nonce,a,b,offered,due) VALUES(?,?,?,?,?,?,?)').run(
          key,
          id,
          nonce,
          a,
          b,
          now,
          now + 2 * FIVE_MINUTES,
        );
        return key;
      });
    },
    accept(id: string, key: string, t: Tape, now: number) {
      atomic(() => {
        const o = get(key);
        if (o?.taker === id) return;
        if (!o || o.state !== 'open' || o.due <= now || o.maker === id) reject('Esta oferta ya no está disponible para ti.');
        const a = t.teams.find((p) => p.id === o.a),
          b = t.teams.find((p) => p.id === o.b);
        if (!t.open || !a || !b || Math.abs(t.ts - now) > 15_000) reject('Esperando precios actuales.');
        charge(id);
        db.prepare("UPDATE duel_order SET taker=?,state='live',startA=?,startB=?,due=? WHERE id=?").run(
          id,
          a.price,
          b.price,
          now + FIVE_MINUTES,
          key,
        );
      });
    },
    cancel(id: string, key: string) {
      atomic(() => {
        const o = get(key);
        if (o?.maker === id && o.verdict === 'cancelled') return;
        if (!o || o.maker !== id || o.state !== 'open') reject('Solo puedes retirar tu propia oferta abierta.');
        finish(o, 'cancelled');
      });
    },
    settle(t: Tape | null, now: number) {
      atomic(() => {
        const rows = db
          .prepare("SELECT * FROM duel_order WHERE state IN ('open','live') AND (due<=? OR ?=1)")
          .all(now, Number(t?.open === false)) as unknown as Order[];
        for (const o of rows) {
          if (o.state === 'open' || t?.open === false) {
            finish(o, 'void');
            continue;
          }
          const a = t?.teams.find((p) => p.id === o.a),
            b = t?.teams.find((p) => p.id === o.b);
          if (t && a && b && t.ts >= o.due && t.ts <= o.due + GRACE) {
            const gap = Math.log(a.price / o.startA) - Math.log(b.price / o.startB);
            finish(o, Math.abs(gap) < 1e-9 ? 'tie' : gap > 0 ? 'a' : 'b', a.price, b.price);
          } else if (now >= o.due + GRACE) finish(o, 'void');
        }
      });
    },
    board(id: string, focused = '') {
      const rows = db
        .prepare(
          `SELECT o.id,o.a,o.b,o.offered,o.state,o.due,o.startA,o.startB,o.endA,o.endB,o.verdict,
        m.name AS maker,t.name AS taker,CASE WHEN o.maker=? THEN 'a' WHEN o.taker=? THEN 'b' ELSE '' END AS mine
        FROM duel_order o JOIN duel_wallet m ON m.id=o.maker LEFT JOIN duel_wallet t ON t.id=o.taker
        WHERE o.id IN (SELECT id FROM duel_order WHERE state='open' ORDER BY offered DESC LIMIT 80)
        OR o.id IN (SELECT id FROM duel_order WHERE maker=? OR taker=? ORDER BY offered DESC LIMIT 40)
        OR o.id=? ORDER BY o.offered DESC`,
        )
        .all(id, id, id, id, focused);
      return { wallet: wallet(id) ?? null, orders: rows };
    },
  };
}
