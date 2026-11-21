import { createHash } from 'node:crypto';
import { apply, settle, view } from './exchange-engine.mjs';
import { EVENT_END } from './exchange-contracts.mjs';

export const DECISION_WINDOW = 24 * 60 * 60 * 1000;
const manualDesk = 'desk:manual';
const resolver = 'Mati';
const openingQuote = { bid: 49, ask: 51, reference: 50 };
const autoReason = 'Pasaron 24 horas desde el cierre sin una decisión de Mati. Se devuelve el costo de las posiciones.';
const number = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 });
const pct = (bps) => number.format(bps / 100) + '%';

function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}

function publicText(value, label, maxLength) {
  const text = typeof value === 'string' ? value.replace(/\r\n?/g, '\n').replaceAll('\t', ' ').trim() : '';
  if (!text || text.length > maxLength || /[\u0000-\u0009\u000b-\u001f\u007f]/u.test(text))
    fail(label + ' debe ser texto público de hasta ' + maxLength + ' caracteres.');
  return text;
}

export function questionFor(market, teamName) {
  if (market.kind === 'manual') return market.question;
  if (market.kind !== 'binary' && market.kind !== 'range') return undefined;
  const name = teamName || market.team.replaceAll('-', ' ');
  const level = market.kind === 'binary' ? pct(market.strike) + ' o más'
    : 'entre ' + pct(market.strike) + ' y ' + pct(market.upper) + ', inclusive';
  return '¿' + name + ' cerrará con una probabilidad oficial de ' + level + '?';
}

// Called only by the authenticated owner's route inside its ledger transaction.
export function createManual(ledger, spec, now = Date.now()) {
  const question = publicText(spec?.question, 'La pregunta', 180);
  const rule = publicText(spec?.rule, 'La regla de resolución', 750);
  const expiry = spec.expiry;
  if (!Number.isSafeInteger(expiry) || expiry <= 0 || expiry > EVENT_END) fail('El cierre debe caer dentro del evento.');
  const digest = createHash('sha256').update(JSON.stringify([question, rule, expiry])).digest('hex');
  const id = 'manual-' + digest.slice(0, 24);
  const receipt = { ok: true, marketId: id };
  if (ledger.engine.markets['$' + id]) return { ...receipt, seededQty: ledger.deskQuotes?.[id]?.seededQty ?? 0 };
  if (expiry <= now) fail('Elige un cierre futuro.');
  const market = { id, event: '26-cl', kind: 'manual', question, title: question, rule, description: rule,
    resolver, expiry, decisionDeadline: expiry + DECISION_WINDOW };
  // One ordinary 1,000-credit wallet funds every manual question. Unfilled orders release their cash at expiry.
  apply(ledger.engine, manualDesk, { type: 'join' }, now);
  const wallet = view(ledger.engine, manualDesk, undefined, now).wallet;
  const pairCost = openingQuote.bid + 100 - openingQuote.ask;
  const qty = wallet.orders.length + 2 <= 32 ? Math.min(2, Math.floor(wallet.available / pairCost)) : 0;
  apply(ledger.engine, manualDesk, { type: 'list', market }, now);
  if (qty > 0) {
    for (const [side, price] of [['buy', openingQuote.bid], ['sell', openingQuote.ask]]) {
      apply(ledger.engine, manualDesk, { type: 'order', marketId: id, side, price, qty, nonce: id + '.' + side }, now);
    }
    ledger.deskQuotes ??= {};
    ledger.deskQuotes[id] = { ...openingQuote, at: now, seededQty: qty };
  }
  return { ...receipt, seededQty: qty };
}

function recordDecision(ledger, market, outcome, reason, now, automatic) {
  const payout = outcome === 'void' ? null : outcome === 'yes' ? 100 : 0;
  const evidence = { source: automatic ? 'Plazo de decisión vencido' : 'Decisión de Mati',
    resolver: automatic ? 'automático' : resolver, expiry: market.expiry, outcome, reason, at: now, automatic };
  return { ...settle(ledger.engine, market.id, payout, evidence, now), outcome, automatic };
}

function refundOverdueManual(ledger, market, now) {
  if (market.kind !== 'manual' || market.status !== 'pending' || now < market.decisionDeadline) return null;
  return recordDecision(ledger, market, 'void', autoReason, now, true);
}

export function refundExpiredQuestions(ledger, now = Date.now(), markets = view(ledger.engine, null, undefined, now).markets) {
  let refunded = 0;
  for (const market of markets) if (refundOverdueManual(ledger, market, now)) refunded++;
  return refunded;
}

export function resolveManual(ledger, input, now = Date.now()) {
  const marketId = input?.marketId;
  if (typeof marketId !== 'string' || !marketId.startsWith('manual-')) fail('Elige una pregunta de Mati.');
  const { market } = view(ledger.engine, null, marketId, now);
  if (market.kind !== 'manual') fail('Elige una pregunta de Mati.');
  const { outcome } = input;
  if (!['yes', 'no', 'void'].includes(outcome)) fail('El resultado debe ser Sí, No o Anulada.');
  const reason = publicText(input.reason, 'El motivo', 750);
  if (market.evidence) {
    if (market.evidence.automatic || market.evidence.outcome !== outcome || market.evidence.reason !== reason)
      fail('Ya existe una decisión definitiva para esta pregunta.', 409);
    return { ok: true, marketId, payout: market.payout, outcome, automatic: false };
  }
  if (now < market.expiry) fail('La pregunta sigue abierta.', 409);
  return refundOverdueManual(ledger, market, now) ?? recordDecision(ledger, market, outcome, reason, now, false);
}
