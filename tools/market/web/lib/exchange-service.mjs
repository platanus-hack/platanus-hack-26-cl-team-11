import { createHash } from 'node:crypto';
import { initialState, apply, replay, view, settle, expireOrders, marketKind } from './exchange-engine.mjs';
import { propose, evaluate, EVENT_END, KINDS } from './exchange-contracts.mjs';
import { starterQuote } from './exchange-quotes.mjs';
import { questionFor, refundExpiredQuestions } from './exchange-predictions.mjs';
export { createManual, resolveManual, refundExpiredQuestions } from './exchange-predictions.mjs';

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
function postDeskQuotes(ledger, board, market, now, replace, actor = house(market.kind), qtyPerSide = 3) {
  const own = view(ledger.engine, actor, market.id, now).wallet;
  const size = { buy: qtyPerSide, sell: qtyPerSide };
  if (replace) {
    // Update only the still-open quantity from the original demonstration quotes.
    size.buy = size.sell = 0;
    for (const order of own.orders.filter((o) => o.marketId === market.id)) {
      size[order.side] += order.remaining;
      apply(ledger.engine, actor, { type: 'cancel', orderId: order.id, nonce: 'replace:' + order.id }, now);
    }
  }
  const quote = starterQuote(market, board);
  const { book, wallet } = view(ledger.engine, actor, market.id, now);
  const bid = Math.min(quote.bid, (book.asks[0]?.price ?? 100) - 1);
  const ask = Math.max(quote.ask, (book.bids[0]?.price ?? 0) + 1);
  let available = wallet.available;
  for (const [side, price, margin] of [
    ['buy', bid, bid],
    ['sell', ask, 100 - ask],
  ]) {
    if (price < 1 || price > 99) continue;
    const qty = Math.min(size[side], Math.floor(available / margin));
    if (!qty) continue;
    apply(
      ledger.engine,
      actor,
      { type: 'order', marketId: market.id, side, price, qty, nonce: (replace ? 'relist2:' : 'start2:') + market.id + side },
      now,
    );
    available -= qty * margin;
  }
  ledger.deskQuotes[market.id] = { ...quote, at: board.at, teamName: board.teams.find((t) => t.id === market.teamId)?.name };
}
function openDesk(ledger, board, now, updating) {
  const expiry = updating
    ? ledger.nextStrip
    : Math.min(EVENT_END, (Math.floor(now / strip) + 1) * strip + (now % strip > strip - 5 * minute ? strip : 0));
  if (expiry < now + 30000) return false;
  ledger.deskQuotes ??= {};
  const featured = updating ? [...ledger.featured] : [];
  const existing = view(ledger.engine, null, undefined, now).markets.filter((m) => featured.includes(m.id));
  for (const spec of deskSpecs(board, expiry)) {
    const previous = existing.find((m) => m.kind === spec.kind);
    if (previous) {
      if (!ledger.deskQuotes[previous.id]) postDeskQuotes(ledger, board, previous, now, true);
      continue;
    }
    const market = propose(spec, board, now);
    const actor = house(spec.kind);
    apply(ledger.engine, actor, { type: 'join' }, now);
    apply(ledger.engine, actor, { type: 'list', market }, now);
    featured.push(market.id);
    postDeskQuotes(ledger, board, market, now, false);
  }
  if (ledger.predictionStrip !== expiry) {
    // The first team already has a binary market in the original desk. A single additional ordinary wallet
    // backs up to four more teams each hour and carries its profits/losses into all subsequent strips.
    const actor = house('predictions');
    apply(ledger.engine, actor, { type: 'join' }, now);
    const predictionIds = [];
    for (const team of board.teams.slice(1, 5)) {
      const strike = Math.min(9999, Math.max(1, Math.round(team.price * 10000)));
      const market = propose({ kind: 'binary', team: team.team, strike, expiry }, board, now);
      if (featured.includes(market.id)) continue;
      const quote = starterQuote(market, board);
      const available = view(ledger.engine, actor, undefined, now).wallet.available;
      const qty = Math.min(2, Math.floor(available / (quote.bid + 100 - quote.ask)));
      if (!qty) break;
      apply(ledger.engine, actor, { type: 'list', market }, now);
      postDeskQuotes(ledger, board, market, now, false, actor, qty);
      predictionIds.push(market.id);
    }
    ledger.predictionIds = predictionIds;
    ledger.predictionStrip = expiry;
  }
  ledger.nextStrip = expiry;
  ledger.featured = featured;
  return true;
}
async function updateMaturities(ledger, selected, prices, now) {
  ledger.missingSince ??= {};
  let changed = expireOrders(ledger.engine, now) > 0;
  const markets = view(ledger.engine, null, undefined, now).markets;
  if (refundExpiredQuestions(ledger, now, markets)) changed = true;
  const pending = markets.filter((m) => m.kind !== 'manual' && m.status === 'pending' && (ledger.nextOracle[m.id] ?? 0) <= now)
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
  const missingOnly =
    now < ledger.nextStrip &&
    (ledger.predictionStrip !== ledger.nextStrip || ledger.featured.length < tradingKinds.length ||
      ledger.featured.some((id) => !ledger.deskQuotes?.[id]));
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
    } else if (action.type === 'order' || action.type === 'bet') {
      if (action.type === 'order' && (!Number.isInteger(action.price) || action.price < 1 || action.price > 99))
        throw problem('El límite va de 1 a 99 fichas.');
      const { marketId, side, price, qty, nonce, outcome, maxPrice } = action;
      const order = action.type === 'bet' ? { type: 'bet', marketId, outcome, maxPrice, qty, nonce }
        : { type: 'order', marketId, side, price, qty, nonce };
      result = replay(ledger.engine, actor, order);
      if (!result) {
        // Owner decisions use the posted rule, independently of the upstream price oracle.
        if (marketKind(ledger.engine, marketId) !== 'manual') {
          const board = await prices.board();
          if (!current(board, Date.now())) throw problem('La fuente de precios está en pausa.', 503);
        }
        result = apply(ledger.engine, actor, order, Date.now());
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
  const picked = (action?.type === 'list' || action?.type === 'bet' ? result.marketId : null) || selected || ledger.featured[0];
  const state = view(ledger.engine, actor, picked, nowView);
  for (const market of state.markets) {
    market.starterQuote = ledger.deskQuotes?.[market.id] ?? null;
    const question = questionFor(market, market.starterQuote?.teamName);
    if (question) market.question = question;
  }
  state.featured = [...ledger.featured, ...(ledger.predictionIds ?? [])];
  state.serverTs = nowView;
  return { changed, result: action ? { result, view: state } : state };
}
