import { createHash } from 'node:crypto';

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const digest = (id) => createHash('sha256').update('presence/26-cl/' + id).digest('hex');
const player = (id) => typeof id === 'string' && id.startsWith('player:');

// Attendance is opt-in at the protocol level: a browser installation id or wallet is
// required. No user agent, network address, cookie, or session credential is recorded.
export function touchPresence(ledger, { actor, visitor, channel }, now = Date.now()) {
  const browserKey = typeof visitor === 'string' && /^[0-9a-f]{32}$/.test(visitor) ? digest('browser:' + visitor) : null;
  const walletKey = player(actor) ? digest(actor) : null;
  if (!walletKey && !browserKey) return false;
  const stats = ledger.attendance ??= { since: now, pruned: now, seen: {}, linked: {} };
  let changed = false;
  if (now - stats.pruned >= 5 * MINUTE) {
    for (const [key, record] of Object.entries(stats.seen)) {
      if (record.last < now - DAY) delete stats.seen[key];
    }
    for (const [browser, wallet] of Object.entries(stats.linked)) {
      if (!stats.seen[wallet]) delete stats.linked[browser];
    }
    stats.pruned = now;
    changed = true;
  }
  const key = walletKey ?? stats.linked[browserKey] ?? browserKey;
  if (browserKey && walletKey && stats.linked[browserKey] !== walletKey) {
    delete stats.seen[browserKey];
    stats.linked[browserKey] = walletKey;
    changed = true;
  }
  const record = stats.seen[key] ??= { last: 0, agent: 0 };
  if (now - record.last >= MINUTE || (channel === 'agent' && now - record.agent >= MINUTE)) {
    record.last = now;
    if (channel === 'agent') record.agent = now;
    changed = true;
  }
  return changed;
}

export function attendance(ledger, now = Date.now()) {
  const seen = Object.values(ledger.attendance?.seen ?? {});
  const fills = ledger.engine.fills;
  const traders = new Set(), recent = new Set(), today = new Set();
  let filled24h = 0;
  for (const f of fills) {
    if (f.at > now) continue;
    const parties = [f.buyer, f.seller].filter(player);
    if (!parties.length) continue;
    if (f.at >= now - DAY) filled24h++;
    for (const actor of parties) {
      traders.add(actor);
      if (f.at >= now - DAY) today.add(actor);
      if (f.at >= now - 15 * MINUTE) recent.add(actor);
    }
  }
  return {
    at: now, since: ledger.attendance?.since ?? null,
    connected5m: seen.filter(p => p.last >= now - 5 * MINUTE).length,
    connected24h: seen.filter(p => p.last >= now - DAY).length,
    agentWallets5m: seen.filter(p => p.agent > 0 && p.agent >= now - 5 * MINUTE).length,
    traders15m: recent.size, traders24h: today.size, tradersSinceOpen: traders.size,
    fills24h: filled24h,
    playerWallets: Object.keys(ledger.engine.wallets).filter(k => k.startsWith('$player:')).length,
    workingPlayerOrders: Object.values(ledger.engine.orders).filter(o =>
      player(o.owner) && ledger.engine.markets['$' + o.marketId]?.end > now).length,
  };
}
