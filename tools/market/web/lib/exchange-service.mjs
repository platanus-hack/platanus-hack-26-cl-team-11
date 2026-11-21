import { createHash } from 'node:crypto';
import { initialState, apply, replay, view, settle, expireOrders } from './exchange-engine.mjs';
import { propose, evaluate, EVENT_END, KINDS } from './exchange-contracts.mjs';

const minute = 60000;
const strip = 60 * minute;
const oracleGrace = 60 * minute;
const tradingKinds = KINDS;
const house = (kind) => 'desk:' + kind;
const problem = (message, status = 400) => Object.assign(new Error(message), { status });

export function initialLedger() {
  return {
    version: 1,
    engine: initialState(),
    nextStrip: 0,
    featured: [],
    nextOracle: {},
    listings: {},
    listReceipts: {},
  };
}
export function requestPrices(loadBoard, loadHistory) {
  let board;
  const series = new Map();
  return {
    board() {
      return (board ??= loadBoard());
    },
    history(id) {
      if (!series.has(id)) series.set(id, loadHistory(id));
      return series.get(id);
    },
  };
}
function current(board, now) {
  return board.status === 'open' && Math.abs(board.at - now) <= 30000 && board.teams.length >= 2;
}
function deskSpecs(board, expiry) {
  const teams = board.teams.slice(0, tradingKinds.length);
  return tradingKinds.map((kind, i) => {
    const team = teams[i % teams.length];
    const basis = Math.min(9990, Math.max(10, Math.round(team.price * 10000)));
    const width = Math.max(5, Math.min(Math.round(basis * 0.15), 10000 - basis, basis));
    const spec = { kind, team: team.team, expiry };
    if (kind === 'linear') return spec;
    if (kind === 'race') return { ...spec, rival: teams[(i + 1) % teams.length].team };
    if (kind === 'range') return { ...spec, strike: basis - width, upper: basis + width };
    if (kind === 'binary') return { ...spec, strike: basis };
    return { ...spec, strike: basis, width };
  });
}
function openDesk(ledger, board, now, missingOnly) {
  const expiry = missingOnly
    ? ledger.nextStrip
    : Math.min(EVENT_END, (Math.floor(now / strip) + 1) * strip + (now % strip > strip - 5 * minute ? strip : 0));
  if (expiry < now + 30000) return false;
  const featured = missingOnly ? [...ledger.featured] : [];
  const existingKinds = new Set(
    missingOnly
      ? view(ledger.engine, null, undefined, now)
          .markets.filter((m) => featured.includes(m.id))
          .map((m) => m.kind)
      : [],
  );
  for (const spec of deskSpecs(board, expiry)) {
    if (existingKinds.has(spec.kind)) continue;
    const market = propose(spec, board, now);
    const actor = house(spec.kind);
    apply(ledger.engine, actor, { type: 'join' }, now);
    apply(ledger.engine, actor, { type: 'list', market }, now);
    featured.push(market.id);
    // Reserve at most the cash left in this desk. All public players can hit these quotes.
    const available = view(ledger.engine, actor, market.id, now).wallet.available;
    const qty = Math.min(3, Math.floor(available / 80));
    if (qty > 0)
      for (const [side, price] of [
        ['buy', 40],
        ['sell', 60],
      ]) {
        apply(
          ledger.engine,
          actor,
          { type: 'order', marketId: market.id, side, price, qty, nonce: market.id + side },
          now,
        );
      }
  }
  ledger.nextStrip = expiry;
  ledger.featured = featured;
  return true;
}
async function updateMaturities(ledger, selected, prices, now) {
  ledger.missingSince ??= {};
  let changed = expireOrders(ledger.engine, now) > 0;
  const pending = view(ledger.engine, null, undefined, now)
    .markets.filter((m) => m.status === 'pending' && (ledger.nextOracle[m.id] ?? 0) <= now)
    .sort((a, b) => Number(b.id === selected) - Number(a.id === selected) || a.expiry - b.expiry)
    .slice(0, 5);
  const resolutions = await Promise.all(
    pending.map(async (m) => {
      try {
        const entries = [[m.team, m.teamId]];
        if (m.rival) entries.push([m.rival, m.rivalId]);
        const history = await Promise.all(entries.map(async ([slug, id]) => [slug, await prices.history(id)]));
        return evaluate(m, Object.fromEntries(history));
      } catch {
        return null;
      }
    }),
  );
  for (const [i, m] of pending.entries()) {
    const resolution = resolutions[i];
    if (!resolution) ledger.missingSince[m.id] ??= now;
    if (resolution || now >= ledger.missingSince[m.id] + oracleGrace) {
      const evidence = resolution?.evidence ?? {
        source: 'Platanus 26-cl',
        expiry: m.expiry,
        reason: 'No se pudo verificar la cotización después de una hora de gracia.',
      };
      settle(ledger.engine, m.id, resolution?.payout ?? null, evidence, now);
      delete ledger.nextOracle[m.id];
      delete ledger.missingSince[m.id];
    } else ledger.nextOracle[m.id] = now + 20000;
    changed = true;
  }
  return changed;
}

async function userListing(ledger, actor, action, prices) {
  const nonce = action.nonce;
  if (typeof nonce !== 'string' || nonce.length < 1 || nonce.length > 128)
    throw problem('Falta el identificador de la orden.');
  if (!action.spec || typeof action.spec !== 'object' || Array.isArray(action.spec))
    throw problem('Faltan los términos del contrato.');
  const signature = JSON.stringify(Object.entries(action.spec).sort(([a], [b]) => a.localeCompare(b)));
  const id = createHash('sha256')
    .update(JSON.stringify([actor, nonce]))
    .digest('hex');
  const prior = ledger.listReceipts[id];
  if (prior) {
    if (prior.signature !== signature) throw problem('Este identificador ya tiene otros términos.', 409);
    return prior.result;
  }
  const board = await prices.board();
  const now = Date.now();
  const market = propose(action.spec, board, now);
  const all = view(ledger.engine, null, undefined, now).markets;
  if (!all.some((m) => m.id === market.id)) {
    const active = all.filter((m) => m.status === 'open');
    if (active.length >= 175 || active.filter((m) => ledger.listings[m.id] === actor).length >= 12)
      throw problem('Se alcanzó el máximo de mercados abiertos.', 409);
    ledger.listings[market.id] = actor;
  }
  const result = apply(ledger.engine, actor, { type: 'list', market, nonce }, now);
  ledger.listReceipts[id] = { signature, result };
  return result;
}

export async function operate(ledger, { actor, action, selected }, prices) {
  if (ledger.version !== 1) throw Error('Unsupported ledger version');
  let now = Date.now();
  let changed = await updateMaturities(ledger, selected, prices, now);
  const missingOnly = now < ledger.nextStrip && ledger.featured.length < tradingKinds.length;
  if ((now >= ledger.nextStrip || missingOnly) && now < EVENT_END) {
    let board;
    try {
      board = await prices.board();
    } catch {
      /* A feed outage does not block cancellations or viewing wallets. */
    }
    now = Date.now();
    if (board && current(board, now)) changed = openDesk(ledger, board, now, missingOnly) || changed;
  }
  let result = null;
  if (action) {
    if (!actor) throw problem('Necesitas la clave de tu billetera.', 401);
    if (action.type !== 'join' && !view(ledger.engine, actor, undefined, now).wallet)
      throw problem('Primero abre tu billetera.', 403);
    if (action.type === 'list') {
      result = await userListing(ledger, actor, action, prices);
    } else if (action.type === 'order') {
      if (!Number.isInteger(action.price) || action.price < 1 || action.price > 99)
        throw problem('El límite va de 1 a 99 fichas.');
      const { marketId, side, price, qty, nonce } = action;
      const order = { type: 'order', marketId, side, price, qty, nonce };
      result = replay(ledger.engine, actor, order);
      if (!result) {
        const board = await prices.board();
        now = Date.now();
        if (!current(board, now)) throw problem('La fuente de precios está en pausa.', 503);
        result = apply(ledger.engine, actor, order, now);
      }
    } else if (action.type === 'cancel') {
      result = apply(
        ledger.engine,
        actor,
        { type: 'cancel', orderId: action.orderId, nonce: action.nonce },
        Date.now(),
      );
    } else if (action.type === 'join') result = apply(ledger.engine, actor, { type: 'join' }, Date.now());
    else throw problem('Acción desconocida.');
    changed = true;
  }
  const nowView = Date.now();
  const picked = (action?.type === 'list' ? result.marketId : null) || selected || ledger.featured[0];
  const state = view(ledger.engine, actor, picked, nowView);
  state.featured = ledger.featured;
  state.serverTs = nowView;
  return { changed, result: action ? { result, view: state } : state };
}
