const number = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 });
const date = new Intl.DateTimeFormat('es-CL', {
  timeZone: 'America/Santiago', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
const time = new Intl.DateTimeFormat('es-CL', {
  timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
export const n = value => number.format(value);
export const when = value => date.format(value);
export const chips = value => n(value) + (value === 1 ? ' ficha' : ' fichas');
export const outcomeText = side => side === 'yes' ? 'Sí' : 'No';
export const isSimple = market => ['manual', 'binary', 'range'].includes(market.kind);
export const link = (id, side) => '/bolsa?marketId=' + encodeURIComponent(id) + (side ? '&lado=' + side : '');
export const advanced = id => '/avanzado?marketId=' + encodeURIComponent(id);
export const esc = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);

export function question(m, teams) {
  if (m.kind === 'manual') return m.question || m.title;
  const team = teams.get(m.team) || m.starterQuote?.teamName || m.team.replace(/^team-(\d+)$/, 'Equipo $1');
  const subject = '¿El precio de ' + team + ' cerrará ';
  if (m.kind === 'range') return subject + 'entre ' + n(m.strike / 100) + ' % y ' + n(m.upper / 100) + ' %?';
  if (m.kind === 'binary') return subject + 'en ' + n(m.strike / 100) + ' % o más?';
  return m.title;
}

export function resultText(m) {
  if (m.status === 'open') return 'Abierta';
  if (m.status === 'pending') return 'Esperando resolución';
  if (m.status === 'voided') return 'Reembolso';
  if (m.payout === 100) return 'Ganó Sí';
  if (m.payout === 0) return 'Ganó No';
  return 'Pago por participación larga: ' + chips(m.payout);
}

// Public depth includes this wallet's resting orders. It cannot bet against itself.
export function levelsFor(view, side) {
  const buyingYes = side === 'yes';
  const orders = (view.wallet?.orders || []).filter(order =>
    order.marketId === view.market.id && order.side === (buyingYes ? 'sell' : 'buy'));
  const own = new Map();
  for (const order of orders) own.set(order.price, (own.get(order.price) || 0) + order.remaining);
  return view.book[buyingYes ? 'asks' : 'bids'].map(level => ({
    price: buyingYes ? level.price : 100 - level.price,
    qty: level.qty - (own.get(level.price) || 0),
  })).filter(level => level.qty > 0 && level.price >= 1 && level.price <= 99);
}

export function quoteFor(levels, qty) {
  if (!Number.isInteger(qty) || qty < 1 || qty > 1000) return null;
  let left = qty;
  let cost = 0;
  for (const level of levels) {
    const take = Math.min(left, level.qty);
    cost += take * level.price;
    left -= take;
    if (!left) return { qty, cost, maxPrice: level.price, cap: qty * level.price, payout: qty * 100 };
  }
  return null;
}

export function chart(points, label, unit) {
  const rows = points.filter(([t, v]) => Number.isFinite(t) && Number.isFinite(v)).sort((a, b) => a[0] - b[0]);
  if (!rows.length) return '<p class="rd-note">Todavía no hay datos para este gráfico.</p>';
  const [first] = rows;
  const last = rows[rows.length - 1];
  let low = rows[0][1], high = low;
  for (const [, value] of rows) {
    low = Math.min(low, value);
    high = Math.max(high, value);
  }
  const padding = Math.max((high - low) * .12, unit === '%' ? .005 : 1);
  const bottom = Math.max(0, low - padding);
  const top = Math.min(100, high + padding);
  const minX = 58, maxX = 493, minY = 12, maxY = 139;
  const x = t => first[0] === last[0] ? (minX + maxX) / 2 : minX + (t - first[0]) * (maxX - minX) / (last[0] - first[0]);
  const y = v => maxY - (v - bottom) * (maxY - minY) / (top - bottom);
  const path = rows.map(([t, v], i) => (i ? 'L' : 'M') + x(t).toFixed(2) + ' ' + y(v).toFixed(2)).join(' ');
  const guides = [top, (top + bottom) / 2, bottom].map(v =>
    '<line x1="' + minX + '" x2="' + maxX + '" y1="' + y(v) + '" y2="' + y(v) +
    '"/><text x="52" y="' + (y(v) + 4) + '" text-anchor="end">' + n(v) + '</text>').join('');
  const latest = 'Último dato: ' + n(last[1]) + ' ' + unit + ' · ' + when(last[0]);
  return '<figure><svg class="chart" viewBox="0 0 500 168" role="img" aria-label="' + esc(label + '. ' + latest) + '">' +
    guides + '<path d="' + path + '"/><circle cx="' + x(last[0]) + '" cy="' + y(last[1]) +
    '" r="3"/><text x="' + minX + '" y="161">' + time.format(first[0]) + '</text><text x="' + maxX +
    '" y="161" text-anchor="end">' + time.format(last[0]) + '</text></svg><figcaption class="rd-note">' +
    esc(latest) + '</figcaption></figure>';
}
