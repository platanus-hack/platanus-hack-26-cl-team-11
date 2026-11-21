import { createHash } from 'node:crypto';

const FACE = 100;
const GRANT = 1000;
const MAX_QTY = 1000;
const MAX_ORDERS = 32;
const key = (id) => '$' + id;
const values = Object.values;
const sum = (items, value) => items.reduce((n, item) => n + value(item), 0);
const units = (lots) => sum(lots, (lot) => lot.qty);
const cost = (lots) => sum(lots, (lot) => lot.unit * lot.qty);
const leg = (side) => side === 'buy' ? 'long' : 'short';
const opposite = (side) => side === 'buy' ? 'short' : 'long';
const margin = (side, price) => side === 'buy' ? price : FACE - price;
const integer = (x, min, max) => Number.isSafeInteger(x) && x >= min && x <= max;

function fail(code, message, status = 400) {
  throw Object.assign(new Error(message), { code, status });
}

function time(input) {
  const n = typeof input === 'string' ? Date.parse(input) : input;
  if (!integer(n, 0, Number.MAX_SAFE_INTEGER)) fail('invalid_time', 'Fecha inválida.');
  return n;
}

function canonical(x) {
  if (Array.isArray(x)) return '[' + x.map(canonical).join(',') + ']';
  if (x !== null && typeof x === 'object') {
    return '{' + Object.keys(x).sort().map(k => JSON.stringify(k) + ':' + canonical(x[k])).join(',') + '}';
  }
  return JSON.stringify(x);
}

function marketSymbol(id) {
  if (typeof id !== 'string' || !/^[A-Za-z0-9_.:-]{1,160}$/.test(id)) {
    fail('invalid_market', 'Identificador de contrato inválido.');
  }
  return key(id);
}

function getMarket(state, id) {
  const market = state.markets[marketSymbol(id)];
  if (!market) fail('market_not_found', 'Contrato desconocido.', 404);
  return market;
}

function status(market, at) {
  if (market.resolution) return market.resolution.payout === null ? 'voided' : 'settled';
  return at < market.end ? 'open' : 'pending';
}

export function initialState() {
  return { version: 1, nextId: 1, markets: {}, wallets: {}, orders: {}, fills: [], requests: {} };
}

function list(state, market) {
  if (!market || typeof market !== 'object' || Array.isArray(market)) fail('invalid_market', 'Falta el contrato.');
  const symbol = marketSymbol(market.id);
  const end = time(market.expiry);
  const existing = state.markets[symbol];
  if (existing && canonical(existing.terms) !== canonical(market)) {
    fail('market_conflict', 'El identificador ya tiene otros términos.', 409);
  }
  if (!existing) {
    state.markets[symbol] = { terms: structuredClone(market), end, volume: 0, lastPrice: null, resolution: null };
  }
  return { ok: true, marketId: market.id };
}

function holding(wallet, marketId) {
  const symbol = key(marketId);
  return wallet.holdings[symbol] ??= { long: [], short: [], settlementCredit: 0, voidCredit: 0 };
}

function addLot(lots, unit, qty) {
  if (!qty) return;
  const last = lots.at(-1);
  if (last?.unit === unit) last.qty += qty;
  else lots.push({ unit, qty });
}

// Move part or all of the FIFO lots. Each lot preserves its original refundable contribution.
function take(lots, qty) {
  const result = [];
  while (qty && lots.length) {
    const lot = lots[0];
    const used = Math.min(qty, lot.qty);
    addLot(result, lot.unit, used);
    lot.qty -= used;
    qty -= used;
    if (!lot.qty) lots.shift();
  }
  return result;
}

function cancelOpen(state, order) {
  const wallet = state.wallets[key(order.owner)];
  wallet.available += (order.remaining - units(order.hedges)) * margin(order.side, order.price);
  if (order.hedges.length) {
    const lots = holding(wallet, order.marketId)[opposite(order.side)];
    for (const lot of order.hedges) addLot(lots, lot.unit, lot.qty);
  }
  delete state.orders[order.id];
}

export function expireOrders(state, now = Date.now()) {
  const at = time(now);
  let count = 0;
  for (const order of values(state.orders)) {
    if (status(state.markets[key(order.marketId)], at) === 'open') continue;
    cancelOpen(state, order);
    count++;
  }
  return count;
}

function fillLeg(state, order, price, qty) {
  const wallet = state.wallets[key(order.owner)];
  const position = holding(wallet, order.marketId);
  const unit = margin(order.side, price);
  const pledged = take(order.hedges, qty);
  const cashUnits = qty - units(pledged);
  // Inventory received after the order was placed can also close this leg.
  const extra = take(position[opposite(order.side)], cashUnits);
  const newUnits = cashUnits - units(extra);
  let released = 0;
  for (const lot of [...pledged, ...extra]) {
    const contributed = lot.unit + unit;
    // The pair pays FACE on settlement and its entry costs on void. Advance only
    // their common floor, so a later tape failure never requires a clawback.
    const advance = Math.min(FACE, contributed);
    released += advance * lot.qty;
    position.settlementCredit += (FACE - advance) * lot.qty;
    position.voidCredit += (contributed - advance) * lot.qty;
  }
  addLot(position[leg(order.side)], unit, newUnits);
  wallet.available += cashUnits * margin(order.side, order.price) + released - qty * unit;
  order.remaining -= qty;
}

function crossingOrders(state, actor, action) {
  const buying = action.side === 'buy';
  const candidates = values(state.orders)
    .filter(o => o.marketId === action.marketId && o.side !== action.side
      && (buying ? o.price <= action.price : o.price >= action.price))
    .sort((a, b) => (buying ? a.price - b.price : b.price - a.price) || a.seq - b.seq);
  const matches = [];
  let remaining = action.qty;
  for (const maker of candidates) {
    if (!remaining) break;
    if (maker.owner === actor) fail('self_match', 'Cancela primero tu orden del lado opuesto.', 409);
    const qty = Math.min(remaining, maker.remaining);
    matches.push({ maker, qty });
    remaining -= qty;
  }
  return { matches, remaining };
}

function place(state, actor, wallet, action, at) {
  const market = getMarket(state, action.marketId);
  if (status(market, at) !== 'open') fail('market_closed', 'El contrato ya cerró.', 409);
  if (action.side !== 'buy' && action.side !== 'sell') fail('invalid_side', 'Lado inválido.');
  if (!integer(action.price, 0, FACE)) fail('invalid_price', 'El precio debe ser un entero de 0 a 100.');
  if (!integer(action.qty, 1, MAX_QTY)) fail('invalid_qty', 'La cantidad debe ser un entero de 1 a 1000.');

  const { matches, remaining } = crossingOrders(state, actor, action);
  if (remaining && values(state.orders).filter(o => o.owner === actor).length >= MAX_ORDERS) {
    fail('order_limit', 'Máximo de 32 órdenes abiertas por billetera.', 409);
  }
  const oppositeLots = wallet.holdings[key(action.marketId)]?.[opposite(action.side)] ?? [];
  const required = Math.max(0, action.qty - units(oppositeLots)) * margin(action.side, action.price);
  if (required > wallet.available) fail('insufficient_funds', 'Saldo disponible insuficiente.', 409);

  const seq = state.nextId++;
  const order = {
    id: 'o' + seq, seq, owner: actor, marketId: action.marketId, side: action.side,
    price: action.price, qty: action.qty, remaining: action.qty, at, hedges: take(oppositeLots, action.qty),
  };
  wallet.available -= required;
  for (const { maker, qty } of matches) {
    fillLeg(state, maker, maker.price, qty);
    fillLeg(state, order, maker.price, qty);
    if (!maker.remaining) delete state.orders[maker.id];
    market.lastPrice = maker.price;
    market.volume += qty;
    state.fills.push({
      id: 'f' + state.nextId++, marketId: action.marketId, price: maker.price, qty, at,
      buyer: action.side === 'buy' ? actor : maker.owner, seller: action.side === 'sell' ? actor : maker.owner,
    });
  }
  if (remaining) state.orders[order.id] = order;
  return { ok: true, orderId: order.id, filled: action.qty - remaining, remaining };
}

function cancel(state, actor, id) {
  if (typeof id !== 'string' || !/^o[1-9][0-9]*$/.test(id)) fail('invalid_order', 'Orden inválida.');
  const order = state.orders[id];
  if (!order || order.owner !== actor) fail('order_not_found', 'Orden abierta desconocida.', 404);
  cancelOpen(state, order);
  return { ok: true, orderId: id, canceled: order.remaining };
}

export function apply(state, actor, action, now = Date.now()) {
  const at = time(now);
  if (typeof actor !== 'string' || !actor.length || actor.length > 256) fail('invalid_actor', 'Billetera inválida.', 401);
  if (!action || typeof action !== 'object' || Array.isArray(action)) fail('invalid_action', 'Acción inválida.');
  const { type, nonce } = action;
  let digest;
  const actorKey = key(actor);
  if (nonce !== undefined || type === 'order' || type === 'cancel') {
    if (typeof nonce !== 'string' || !/^[A-Za-z0-9_.:-]{1,128}$/.test(nonce)) {
      fail('invalid_nonce', 'Falta un identificador de operación válido.');
    }
    digest = createHash('sha256').update(canonical(action)).digest('hex');
    const prior = state.requests[actorKey]?.[key(nonce)];
    if (prior) {
      if (prior.digest !== digest) fail('nonce_conflict', 'Ese identificador corresponde a otra operación.', 409);
      return structuredClone(prior.result);
    }
  }
  expireOrders(state, at);
  let result;
  if (type === 'list') result = list(state, action.market);
  else if (type === 'join') {
    state.wallets[actorKey] ??= { available: GRANT, holdings: {}, settlements: [] };
    result = { ok: true };
  } else {
    const wallet = state.wallets[actorKey];
    if (!wallet) fail('join_required', 'Primero abre tu billetera.', 401);
    if (type === 'order') result = place(state, actor, wallet, action, at);
    else if (type === 'cancel') result = cancel(state, actor, action.orderId);
    else fail('invalid_action', 'Acción desconocida.');
  }
  if (digest) {
    (state.requests[actorKey] ??= {})[key(nonce)] = { digest, result: structuredClone(result) };
  }
  return result;
}

export function settle(state, marketId, payout, evidence, now = Date.now()) {
  const at = time(now);
  const market = getMarket(state, marketId);
  if (payout !== null && !integer(payout, 0, FACE)) fail('invalid_payout', 'Liquidación inválida.');
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) fail('invalid_evidence', 'Falta la evidencia.');
  if (market.resolution && market.resolution.payout !== payout) {
    fail('resolution_conflict', 'Ya existe otra liquidación.', 409);
  }
  const result = { ok: true, marketId, payout };
  if (market.resolution) return result;
  if (at < market.end) fail('not_expired', 'El contrato sigue abierto.', 409);
  expireOrders(state, at);
  for (const wallet of values(state.wallets)) {
    const position = wallet.holdings[key(marketId)];
    if (!position) continue;
    const amount = payout === null
      ? cost(position.long) + cost(position.short) + position.voidCredit
      : units(position.long) * payout + units(position.short) * (FACE - payout) + position.settlementCredit;
    wallet.available += amount;
    wallet.settlements.push({ marketId, amount, payout, at });
    delete wallet.holdings[key(marketId)];
  }
  market.resolution = { payout, evidence: structuredClone(evidence), at };
  return result;
}

function depth(orders, side) {
  const levels = new Map();
  for (const order of orders) {
    if (order.side === side) levels.set(order.price, (levels.get(order.price) ?? 0) + order.remaining);
  }
  return [...levels].map(([price, qty]) => ({ price, qty }))
    .sort((a, b) => side === 'buy' ? b.price - a.price : a.price - b.price);
}

function publicFill({ id, marketId, price, qty, at }) {
  return { id, marketId, price, qty, at };
}

function walletView(state, actor) {
  const wallet = state.wallets[key(actor)];
  if (!wallet) return null;
  const orders = values(state.orders).filter(o => o.owner === actor);
  let locked = 0;
  const positions = new Map();
  const addPosition = (marketId, side, lots, pledged = false) => {
    if (!lots.length) return;
    const id = marketId + '/' + side;
    const row = positions.get(id) ?? { marketId, side, qty: 0, collateral: 0, pledged: 0 };
    row.qty += units(lots);
    row.collateral += cost(lots);
    if (pledged) row.pledged += units(lots);
    positions.set(id, row);
  };
  let settlementCredit = 0;
  let voidCredit = 0;
  const credits = [];
  for (const [symbol, p] of Object.entries(wallet.holdings)) {
    const id = symbol.slice(1);
    addPosition(id, 'long', p.long);
    addPosition(id, 'short', p.short);
    settlementCredit += p.settlementCredit;
    voidCredit += p.voidCredit;
    if (p.voidCredit || p.settlementCredit) {
      credits.push({ marketId: id, settlementCredit: p.settlementCredit, voidCredit: p.voidCredit });
    }
  }
  for (const o of orders) {
    locked += (o.remaining - units(o.hedges)) * margin(o.side, o.price);
    addPosition(o.marketId, opposite(o.side), o.hedges, true);
  }
  const collateral = sum([...positions.values()], p => p.collateral) + voidCredit;
  const fills = [];
  for (let i = state.fills.length - 1; i >= 0 && fills.length < 100; i--) {
    const f = state.fills[i];
    if (f.buyer === actor || f.seller === actor) {
      fills.push({ ...publicFill(f), side: f.buyer === actor ? 'buy' : 'sell' });
    }
  }
  return {
    available: wallet.available, locked, collateral, equityAtCost: wallet.available + locked + collateral,
    orders: orders.map(({ id, marketId, side, price, qty, remaining, at }) => ({ id, marketId, side, price, qty, remaining, at })),
    positions: [...positions.values()], settlementCredit, voidCredit, credits, fills,
    settlements: wallet.settlements.slice(-100).reverse(),
  };
}

export function view(state, actor = null, marketId = null, now = Date.now()) {
  const at = time(now);
  // GET is side-effect free. Reflect refunds immediately even before a durable housekeeping write.
  if (values(state.orders).some(o => state.markets[key(o.marketId)].end <= at)) {
    state = structuredClone(state);
    expireOrders(state, at);
  }
  if (marketId != null) getMarket(state, marketId);
  const ordersByMarket = new Map();
  for (const o of values(state.orders)) {
    const group = ordersByMarket.get(o.marketId) ?? [];
    group.push(o);
    ordersByMarket.set(o.marketId, group);
  }
  const markets = values(state.markets).map(m => {
    const orders = ordersByMarket.get(m.terms.id) ?? [];
    return {
      ...structuredClone(m.terms), status: status(m, at),
      bestBid: depth(orders, 'buy')[0]?.price ?? null, bestAsk: depth(orders, 'sell')[0]?.price ?? null,
      lastPrice: m.lastPrice, volume: m.volume, payout: m.resolution?.payout ?? null,
      evidence: m.resolution ? structuredClone(m.resolution.evidence) : null, settledAt: m.resolution?.at ?? null,
    };
  });
  const market = (marketId != null ? markets.find(m => m.id === marketId) : markets.find(m => m.status === 'open') ?? markets[0]) ?? null;
  const orders = ordersByMarket.get(market?.id) ?? [];
  const fills = [];
  for (let i = state.fills.length - 1; i >= 0 && fills.length < 50; i--) {
    if (state.fills[i].marketId === market?.id) fills.push(publicFill(state.fills[i]));
  }
  return { markets, market, book: { bids: depth(orders, 'buy'), asks: depth(orders, 'sell') }, fills,
    wallet: actor == null ? null : walletView(state, actor) };
}
