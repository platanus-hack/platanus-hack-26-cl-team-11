import { createHash } from 'node:crypto';

const EVENT = '26-cl';
export const EVENT_END = Date.parse('2026-11-22T19:00:00Z');
export const KINDS = Object.freeze(['binary', 'call', 'put', 'future', 'range', 'race', 'butterfly', 'linear', 'straddle']);
const widthKinds = new Set(['call', 'put', 'future', 'butterfly', 'straddle']);
const names = {
  binary: 'Binaria', call: 'Call', put: 'Put', future: 'Futuro', range: 'Rango', race: 'Carrera',
  butterfly: 'Mariposa', linear: 'Futuro lineal', straddle: 'Straddle',
};
const decimal = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 });
const pct = (bps) => decimal.format(bps / 100) + '%';
const pp = (bps) => decimal.format(bps / 100) + ' pp';

function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}

function probability(price) {
  return Number.isFinite(price) && price >= 0 && price <= 1;
}

function priceBps(price) {
  // Shift the decimal representation so a published price of 0.00015 rounds to 2 bps.
  const [digits, exponent] = price.toExponential().split('e');
  return Math.round(Number(digits + 'e' + (Number(exponent) + 4)));
}

function bps(value, label, min = 0) {
  if (!Number.isInteger(value) || value < min || value > 10000) {
    fail(`${label} debe ser un entero entre ${min} y 10000 puntos base.`);
  }
  return value;
}

function lookup(board, slug) {
  const team = typeof slug === 'string' && board.teams.find((entry) => entry.team === slug);
  if (!team) fail('El equipo debe aparecer en el mercado oficial.');
  if (typeof team.id !== 'string' || !team.id.length || !probability(team.price)) {
    fail('El equipo no tiene una cotización oficial válida.', 503);
  }
  return team;
}

export function describe(market) {
  const { kind, strike, width, upper, team, rival, baseline, rivalBaseline } = market;
  switch (kind) {
    case 'binary': return `Paga 100 si ${team} cierra en ${pct(strike)} o más. Por debajo paga 0.`;
    case 'range': return `Paga 100 si ${team} cierra entre ${pct(strike)} y ${pct(upper)}, incluidos ambos extremos. Fuera del rango paga 0.`;
    case 'call': return `Paga 0 hasta ${pct(strike)}. Por encima, el pago sube linealmente hasta 100 al ganar ${pp(width)} desde ese nivel.`;
    case 'put': return `Paga 0 desde ${pct(strike)} hacia arriba. Por debajo, el pago sube linealmente hasta 100 al perder ${pp(width)} desde ese nivel.`;
    case 'future': return `Paga 50 en ${pct(strike)}. El pago sube o baja linealmente, 50 por cada ${pp(width)}, con mínimo 0 y máximo 100.`;
    case 'linear': return `El largo cobra un crédito por cada punto porcentual del precio de cierre de ${team}, redondeado al crédito más cercano. El corto cobra el resto hasta 100. Si compras a 12 y cierra en 17%, ganas 5 créditos por contrato.`;
    case 'butterfly': return `Paga 100 en ${pct(strike)}. El pago cae linealmente hasta 0 a una distancia de ${pp(width)} por encima o por debajo.`;
    case 'straddle': return `Paga 0 en ${pct(strike)}. El pago sube linealmente cuanto más se aleja el cierre de ese nivel, en cualquier dirección. A una distancia de ${pp(width)} o más paga 100.`;
    case 'race': return `Gana el equipo con mayor variación porcentual desde su precio inicial. ${team} parte en ${pct(baseline)} y ${rival} en ${pct(rivalBaseline)}. Paga 100 si gana ${team}, 50 si empatan y 0 si gana ${rival}.`;
    default: fail('Tipo de contrato desconocido.');
  }
}

// Identical economic terms share an order book. Only races lock the entry prices.
export function propose(spec, board, now = Date.now()) {
  if (board?.event !== EVENT || board.status !== 'open' || !Array.isArray(board.teams) ||
      !Number.isSafeInteger(board.at) || !Number.isSafeInteger(now) || Math.abs(board.at - now) > 30000) {
    fail('Se necesita una cotización reciente del mercado abierto de Platanus.', 503);
  }
  if (!KINDS.includes(spec?.kind)) fail('Tipo de contrato desconocido.');
  const { kind, expiry } = spec;
  if (!Number.isSafeInteger(expiry) || expiry % 60000 !== 0 || expiry - now < 30000 ||
      expiry <= board.at || expiry > Math.min(now + 86400000, EVENT_END)) {
    fail('El vencimiento debe caer en un minuto entero, al menos 30 segundos y hasta 24 horas en el futuro, dentro del evento.');
  }
  const team = lookup(board, spec.team);
  const terms = { event: EVENT, kind, team: team.team, teamId: team.id, expiry };
  let subject = team.team;
  if (kind === 'race') {
    const rival = lookup(board, spec.rival);
    if (rival.id === team.id) fail('Elige dos equipos distintos para la carrera.');
    terms.rival = rival.team;
    terms.rivalId = rival.id;
    terms.baseline = priceBps(team.price);
    terms.rivalBaseline = priceBps(rival.price);
    if (!terms.baseline || !terms.rivalBaseline) fail('La carrera requiere precios iniciales de al menos un punto base.');
    subject += ' vs. ' + rival.team;
  } else if (kind !== 'linear') {
    terms.strike = bps(spec.strike, 'El nivel');
    if (widthKinds.has(kind)) terms.width = bps(spec.width, 'La amplitud', 1);
    if (kind === 'range') {
      terms.upper = bps(spec.upper, 'El límite superior');
      if (terms.upper <= terms.strike) fail('El límite superior debe ser mayor que el inferior.');
    }
    subject += ' · ' + pct(terms.strike);
    if (kind === 'range') subject += '–' + pct(terms.upper);
  }
  const id = 'px-' + createHash('sha256').update(JSON.stringify(terms)).digest('hex').slice(0, 24);
  return {
    id, ...terms,
    title: names[kind] + ' · ' + subject, description: describe(terms),
  };
}

function observation(series, team, id, expiry) {
  const rows = series instanceof Map
    ? series.get(team) ?? series.get(id)
    : series?.[team] ?? series?.[id];
  if (!Array.isArray(rows)) return null;
  let asOf = null;
  let coveredThrough = Infinity;
  for (const row of rows) {
    if (!Array.isArray(row) || !Number.isSafeInteger(row[0]) || !probability(row[1])) return null;
    const [at] = row;
    if (at <= expiry && (!asOf || asOf[0] <= at)) asOf = row;
    if (at >= expiry && at < coveredThrough) coveredThrough = at;
  }
  if (!asOf || !Number.isFinite(coveredThrough)) return null;
  return { team, id, at: asOf[0], price: asOf[1], priceBps: priceBps(asOf[1]), coveredThrough };
}

// Use the last published price at or before expiry. A later tick proves coverage
// through an inactive interval but never supplies the settlement price.
export function evaluate(market, seriesByTeam) {
  const { kind, strike, width, upper, expiry } = market;
  const team = observation(seriesByTeam, market.team, market.teamId, expiry);
  if (!team) return null;
  const observations = [team];
  const close = team.priceBps;
  let longPayout;
  switch (kind) {
    case 'binary': longPayout = close >= strike ? 100 : 0; break;
    case 'range': longPayout = close >= strike && close <= upper ? 100 : 0; break;
    case 'call': longPayout = 100 * (close - strike) / width; break;
    case 'put': longPayout = 100 * (strike - close) / width; break;
    case 'future': longPayout = 50 + 50 * (close - strike) / width; break;
    case 'linear': longPayout = close / 100; break;
    case 'butterfly': longPayout = 100 - 100 * Math.abs(close - strike) / width; break;
    case 'straddle': longPayout = 100 * Math.abs(close - strike) / width; break;
    case 'race': {
      const rival = observation(seriesByTeam, market.rival, market.rivalId, expiry);
      if (!rival) return null;
      team.baseline = market.baseline;
      rival.baseline = market.rivalBaseline;
      observations.push(rival);
      // Cross-multiply the two return multiples to preserve exact ties.
      const difference = close * market.rivalBaseline - rival.priceBps * market.baseline;
      longPayout = 50 + 50 * Math.sign(difference);
      break;
    }
    default: fail('Tipo de contrato desconocido.');
  }
  return {
    payout: Math.max(0, Math.min(100, Math.round(longPayout))),
    evidence: { source: 'https://hack.platan.us/api/market/history/', event: market.event, expiry, observations },
  };
}
