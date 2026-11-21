import { advanced, chart, chips, esc, isSimple, levelsFor, link, n, outcomeText, question, quoteFor, resultText, when } from './apuestas-modelo.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const marketId = params.get('marketId');
const account = !marketId && params.get('vista') === 'mis-apuestas';
const results = !marketId && params.get('vista') === 'resultados';
const walletKey = 'mesa26.exchange.wallet.v1';
const visitorKey = 'mesa26.exchange.visitor.v1';
const pendingKey = 'mesa26.exchange.bet.pending.v1';
const teams = new Map();
let side = params.get('lado') === 'no' ? 'no' : 'yes';
let qtyText = '1';
let view;
let quote;
let active = false;
let fetching = false;
let pulsing = false;
let revision = 0;
let lastRead = 0;
let series;
let chartError = false;
let clockOffset = 0;
let submitReceipt = '';
let pending;
try { pending = JSON.parse(sessionStorage.getItem(pendingKey) || 'null'); } catch { /* Storage may be unavailable. */ }
if (pending && pending.marketId === marketId) {
  side = pending.outcome;
  qtyText = String(pending.qty);
}

function identifier(key, bytes, create) {
  const stored = localStorage.getItem(key);
  if (stored && stored.length === bytes * 2 && /^[a-f0-9]+$/.test(stored)) return stored;
  if (!create) return '';
  const value = Array.from(crypto.getRandomValues(new Uint8Array(bytes)), v => v.toString(16).padStart(2, '0')).join('');
  localStorage.setItem(key, value);
  return value;
}

async function api(action, id = marketId) {
  const headers = { Accept: 'application/json' };
  try {
    const token = identifier(walletKey, 32, !!action);
    if (token) headers.Authorization = 'Bearer ' + token;
    headers['X-Exchange-Visitor'] = identifier(visitorKey, 16, true);
  } catch {
    if (action) throw new Error('Permite guardar datos en este navegador para conservar tus fichas.');
  }
  if (action) headers['Content-Type'] = 'application/json';
  const response = await fetch('/api/exchange' + (id ? '?marketId=' + encodeURIComponent(id) : ''), {
    method: action ? 'POST' : 'GET', headers,
    ...(action && { body: JSON.stringify(action) }), signal: AbortSignal.timeout(18000),
  });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.error || 'No se pudo leer el mercado.'), { status: response.status });
  return data;
}

function message(html) { $('feedback').innerHTML = html; }
function title(value) { $('heading').textContent = value; document.title = value + ' · Mesa 26'; }
function label(m) { return question(m, teams); }
function resolutionLabel(m) { return m.kind === 'manual' ? 'Resuelve ' + (m.resolver || 'Mati') : 'Automática con precios de Platanus'; }
function marketLink(m) { return isSimple(m) ? link(m.id) : advanced(m.id); }
function rate(price) { return price == null ? '—' : n(price); }
function note(text) { return '<p class="rd-note">' + esc(text) + '</p>'; }

function renderList() {
  title('Apuestas');
  const markets = view.markets.filter(m => isSimple(m) && (results ? m.status !== 'open' : m.status === 'open'));
  markets.sort((a, b) => results ? b.expiry - a.expiry :
    Number(b.kind === 'manual') - Number(a.kind === 'manual') || a.expiry - b.expiry);
  const rows = markets.map(m => {
    const destination = link(m.id);
    const end = results ? '<strong>' + esc(resultText(m)) + '</strong>' :
      '<div class="choices" aria-label="Precio por participación">' + ['yes', 'no'].map(s => {
        const price = s === 'yes' ? m.bestAsk : m.bestBid == null ? null : 100 - m.bestBid;
        const text = outcomeText(s) + ' ' + rate(price);
        return '<a class="quote" href="' + esc(link(m.id, s)) + '" aria-label="' + esc(outcomeText(s) + ', ' +
          (price == null ? 'sin oferta' : chips(price)) + '. ' + label(m)) + '">' + esc(text) + '</a>';
      }).join('') + '</div>';
    return '<li class="question"><div><a class="question-title" href="' + destination + '">' + esc(label(m)) +
      '</a><p class="meta">' + (m.status === 'open' ? 'Cierra ' : 'Cierre ') + esc(when(m.expiry)) +
      ' · ' + esc(resolutionLabel(m)) + '</p></div>' + end + '</li>';
  }).join('');
  $('content').innerHTML = '<p class="intro">Elige Sí o No. Si aciertas, cada participación paga 100 fichas de juego.</p>' +
    '<div class="section-head"><nav class="filters" aria-label="Estado de las preguntas"><a href="/bolsa"' +
    (!results ? ' aria-current="page"' : '') + '>Abiertas (' + n(view.markets.filter(m => isSimple(m) && m.status === 'open').length) +
    ')</a><a href="/bolsa?vista=resultados"' + (results ? ' aria-current="page"' : '') + '>Resultados</a></nav>' +
    (results ? '' : '<span class="rd-note">Precios en fichas por participación</span>') + '</div>' +
    '<ul class="list">' + rows + '</ul>' +
    (rows ? '' : '<p>' + (results ? 'Aún no hay preguntas cerradas.' : 'Ahora no hay preguntas abiertas.') + '</p>') +
    '<button class="minor space" data-action="refresh" type="button">Actualizar preguntas</button>';
}

function accountRows(items, format) {
  return '<ul class="list">' + items.map(row => {
    const m = view.markets.find(market => market.id === row.marketId);
    if (!m) return '';
    return '<li><a href="' + marketLink(m) + '" class="question-title">' + esc(label(m)) + '</a><p class="meta">' +
      esc(format(row, m)) + '</p></li>';
  }).join('') + '</ul>';
}
function personalSide(p, m) {
  return isSimple(m) ? (p.side === 'long' ? 'Sí' : 'No') : (p.side === 'long' ? 'Largo' : 'Corto');
}
function positionText(p, m) {
  return personalSide(p, m) + ' · ' + n(p.qty) + (p.qty === 1 ? ' participación' : ' participaciones') +
    ' · Costo ' + chips(p.collateral) + (p.pledged ? ' · ' + n(p.pledged) + ' en órdenes abiertas' : '');
}
function renderAccount() {
  title('Mis apuestas');
  const w = view.wallet;
  if (!w) {
    $('content').innerHTML = '<p>Aún no has apostado desde este navegador. Al confirmar tu primera apuesta recibirás 1.000 fichas de juego.</p><a href="/bolsa">Ver preguntas abiertas</a>';
    return;
  }
  $('content').innerHTML = '<p class="intro">Saldo disponible <strong>' + chips(w.available) + '</strong>' +
    (w.locked ? ' · En órdenes abiertas ' + chips(w.locked) : '') + '</p><section><h2>Participaciones abiertas</h2>' +
    (w.positions.length ? accountRows(w.positions, positionText) : note('Aún no tienes participaciones abiertas.')) +
    '</section>' + (w.credits?.length ? '<section class="space"><h2>Créditos pendientes</h2>' + accountRows(w.credits,
      c => 'Si se resuelve: ' + chips(c.settlementCredit) + ' · Si se anula: ' + chips(c.voidCredit)) + '</section>' : '') +
    '<section class="space"><h2>Resultados de mis apuestas</h2>' + (w.settlements.length ? accountRows(w.settlements,
      (s, m) => resultText(m) + ' · ' + (s.payout === null ? 'Reembolso' : 'Pago al cierre') + ' ' + chips(s.amount) +
      ' · ' + when(s.at)) : note('Aquí aparecerá el pago cuando se resuelva una de tus apuestas.')) +
    '</section><p class="space"><a href="/bolsa">Ver preguntas abiertas</a></p>';
}

function rules(m) {
  const rule = m.kind === 'manual' ? m.rule || m.description : m.description.replace(/\bteam-(\d+)\b/g, (slug, id) => teams.get(slug) || 'Equipo ' + id);
  const info = m.kind === 'manual'
    ? 'Mati elige Sí, No o reembolso según esta regla.' +
      (m.decisionDeadline ? ' Si no publica una decisión antes del ' + when(m.decisionDeadline) + ', se reembolsa la apuesta.' : '')
    : 'Se usa el último precio oficial al cierre o antes. Si la fuente sigue sin poder verificarse tras una hora de gracia, se reembolsa la apuesta.';
  return '<section class="rules"><h2>Cómo se resuelve</h2><p>' + esc(rule) + '</p><p class="meta"><strong>' +
    esc(resolutionLabel(m)) + '</strong> · Cierre ' + esc(when(m.expiry)) + '</p><p class="rd-note">' + esc(info) + '</p>' +
    (m.status !== 'open' && m.evidence?.reason ? '<p><strong>Motivo</strong> ' + esc(m.evidence.reason) + '</p>' : '') +
    (m.evidence?.observations || []).map(obs => '<p class="rd-note">Precio observado de ' + esc(teams.get(obs.team) || obs.team) +
      ': ' + n(obs.price * 100) + ' % · ' + when(obs.at) + '</p>').join('') + '</section>';
}

function renderChart() {
  const host = $('chart-area');
  if (!host) return;
  const fills = [...view.fills].reverse();
  if (fills.length || view.market.kind === 'manual') {
    host.innerHTML = '<h2>Precio de Sí</h2><p class="meta">Fichas por participación en las últimas operaciones de esta pregunta.</p>' +
      (fills.length ? chart(fills.map(f => [f.at, f.price]), 'Precio negociado de Sí', 'fichas') : note('Todavía no hay operaciones para graficar.'));
  } else {
    host.innerHTML = '<h2>Precio del equipo en Platanus</h2><p class="meta">Cotización oficial del equipo durante los últimos 30 minutos.</p>' +
      (series ? chart(series.points.map(([t, v]) => [t, v * 100]), 'Cotización oficial del equipo', '%')
        : note(chartError ? 'No se pudo leer el historial del equipo.' : 'Cargando el historial…'));
  }
}

function renderDetail() {
  const m = view.market;
  title(label(m));
  if (!$('back')) {
    const back = document.createElement('a');
    back.id = 'back'; back.className = 'back'; back.href = '/bolsa'; back.textContent = '← Preguntas';
    $('heading').before(back);
  }
  const positions = (view.wallet?.positions || []).filter(p => p.marketId === m.id);
  const settlement = view.wallet?.settlements.find(s => s.marketId === m.id);
  const holdings = positions.map(p => '<p class="meta">' + esc(positionText(p, m)) + '</p>').join('');
  const ticket = m.status === 'open' ? '<form id="ticket"><h2>Tu apuesta</h2><fieldset><legend>Resultado</legend>' +
    '<div class="sides">' + ['yes', 'no'].map(s => '<label><input type="radio" name="lado" value="' + s + '"' +
      (side === s ? ' checked' : '') + '>' + outcomeText(s) + ' · ' + rate(levelsFor(view, s)[0]?.price) + '</label>').join('') +
    '</div></fieldset><label for="quantity">Participaciones</label><div class="amounts"><input class="rd-input" id="quantity" name="cantidad" type="number" inputmode="numeric" min="1" max="1000" step="1" required autocomplete="off" value="' +
    esc(qtyText) + '">' + [1, 3, 10].map(q => '<button type="button" data-qty="' + q + '">' + q + '</button>').join('') +
    '</div><p id="liquidity" class="meta"></p><div id="preview" aria-live="polite"></div>' +
    '<button type="submit" id="confirm" class="rd-button submit">Confirmar apuesta</button>' +
    '<p class="rd-note" id="wallet-note"></p><button class="minor" type="button" data-action="refresh">Actualizar precios</button>' +
    '<p class="meta" id="quote-update" role="status">Precios del ' + esc(when(view.serverTs)) + '.</p></form>'
    : '<h2>' + esc(resultText(m)) + '</h2><p>' + esc(m.status === 'pending' ? 'La pregunta cerró. La resolución aparecerá aquí.' :
      m.status === 'voided' ? 'Las apuestas se reembolsaron.' : 'Cada participación ganadora pagó 100 fichas.') + '</p>' +
      (settlement ? '<p>Tu ' + (settlement.payout === null ? 'reembolso' : 'pago') + ' fue de <strong>' + chips(settlement.amount) + '</strong>.</p>' : '') +
      '<button class="minor" data-action="refresh" type="button">Actualizar resultado</button>';
  $('content').innerHTML = '<div class="dual">' + rules(m) + '<aside class="ticket">' + ticket +
    (holdings ? '<section class="space"><h3>Tus participaciones</h3>' + holdings + '</section>' : '') +
    '</aside><section id="chart-area" class="history"></section></div>';
  renderQuote();
  renderChart();
}

function metric(term, value) {
  return '<div><dt>' + esc(term) + '</dt><dd>' + esc(value) + '</dd></div>';
}
function renderQuote() {
  if (!$('ticket')) return;
  const levels = levelsFor(view, side);
  const qty = Number(qtyText);
  const availableQty = levels.reduce((total, level) => total + level.qty, 0);
  const funds = view.wallet?.available ?? 1000;
  const opposite = (view.wallet?.positions || []).some(p =>
    p.marketId === marketId && p.side === (side === 'yes' ? 'short' : 'long') && p.qty > 0);
  quote = quoteFor(levels, qty);
  let issue = '';
  if (opposite) issue = 'Ya tienes participaciones del otro lado. Puedes gestionarlas en el mercado avanzado.';
  else if (!availableQty) issue = 'Aún no hay ofertas para este lado.';
  else if (!Number.isInteger(qty) || qty < 1 || qty > 1000) issue = 'Ingresa entre 1 y 1.000 participaciones enteras.';
  else if (!quote) issue = 'No alcanzan las ofertas para esa cantidad. Reduce las participaciones o actualiza los precios.';
  else if (quote.cost > funds) issue = 'Tu saldo disponible es menor que el costo actual. Reduce la cantidad.';
  else if (Date.now() + clockOffset >= view.market.expiry) issue = 'La pregunta cerró. Actualiza para ver la resolución.';

  $('liquidity').textContent = availableQty ? 'Hay ' + n(availableQty) + (availableQty === 1 ? ' disponible' : ' disponibles') +
    (levels.length === 1 ? ' a ' + chips(levels[0].price) + ' cada una.' : ' desde ' + chips(levels[0].price) + ' cada una.') : '';
  $('preview').innerHTML = (quote ? '<dl class="metrics">' + metric(quote.cap === quote.cost ? 'Costo máximo' : 'Costo al precio actual', chips(quote.cost)) +
    (quote.cap !== quote.cost ? metric('Costo máximo autorizado', chips(quote.cap)) : '') + metric('Pago si aciertas', chips(quote.payout)) +
    metric('Ganancia mínima si aciertas', chips(quote.payout - quote.cap)) + '</dl>' : '') +
    (issue ? note(issue) : '') + (opposite ? '<a href="' + advanced(marketId) + '">Ver posición avanzada</a>' :
      !quote && Number.isInteger(qty) && qty > availableQty ? '<a href="' + advanced(marketId) + '">Publicar una oferta</a>' : '');
  $('confirm').disabled = !!issue || active || fetching || !!pending;
  $('confirm').textContent = active ? 'Confirmando…' : 'Confirmar ' + outcomeText(side) + (quote ? ' · hasta ' + chips(quote.cap) : '');
  $('wallet-note').textContent = view.wallet ? 'Saldo disponible: ' + chips(funds) + '.' :
    'Al confirmar recibirás 1.000 fichas de juego en este navegador.';
  for (const input of document.querySelectorAll('#ticket input, [data-qty]')) input.disabled = active || !!pending;
  for (const button of document.querySelectorAll('[data-qty]')) button.setAttribute('aria-pressed', String(qty === Number(button.dataset.qty)));
}

function showPending() {
  if (!pending) return;
  if (marketId === pending.marketId) {
    message('Falta confirmar tu apuesta a ' + outcomeText(pending.outcome) + ' por ' + n(pending.qty) +
      (pending.qty === 1 ? ' participación' : ' participaciones') + ', hasta ' + chips(pending.qty * pending.maxPrice) +
      '. <button type="button" class="minor" data-action="retry">Consultar el mismo envío</button>');
  } else {
    message('Hay una apuesta pendiente de confirmación. <a href="' + esc(link(pending.marketId, pending.outcome)) + '">Ver apuesta pendiente</a>');
  }
}
function render() {
  $('balance').textContent = view.wallet ? 'Saldo · ' + chips(view.wallet.available) : '';
  $(account ? 'account-link' : 'home-link').setAttribute('aria-current', 'page');
  if (marketId) renderDetail();
  else if (account) renderAccount();
  else renderList();
  if (pending) showPending();
  else if (submitReceipt) message(submitReceipt);
}

async function fetchSeries() {
  if (!marketId || view.market.kind === 'manual' || view.fills.length) return;
  try {
    const response = await fetch('/api/terminal?team=' + encodeURIComponent(view.market.team), { signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw Error();
    const data = await response.json();
    if (!Array.isArray(data.points)) throw Error();
    series = data;
    chartError = false;
    if (data.name && data.name !== view.market.team) {
      teams.set(view.market.team, data.name);
      title(label(view.market));
    }
  } catch { chartError = true; }
  renderChart();
}
async function refresh() {
  if (fetching || active) return;
  fetching = true;
  revision++;
  if (view) renderQuote();
  try {
    const data = await api();
    if (marketId && !isSimple(data.market)) {
      location.replace(advanced(marketId));
      return;
    }
    view = data;
    lastRead = Date.now();
    clockOffset = (data.serverTs || lastRead) - lastRead;
    if (!submitReceipt && !pending) message('');
    render();
    void fetchSeries();
  } catch (error) {
    const text = Number.isInteger(error.status) ? error.message : 'No se pudo actualizar el mercado.';
    message(esc(text) + ' <button class="minor" type="button" data-action="refresh">Reintentar</button>' +
      (marketId ? ' <a href="/bolsa">Ver todas las preguntas</a>' : ''));
    if (!view) $('content').innerHTML = '';
    if (pending) showPending();
  } finally {
    fetching = false;
    if (view) renderQuote();
  }
}

async function send(op) {
  if (active || fetching || marketId !== op.marketId) return;
  active = true;
  revision++;
  submitReceipt = '';
  try {
    identifier(walletKey, 32, true);
    // Persist before any request. A timeout or reload can only replay the same authorized bet.
    sessionStorage.setItem(pendingKey, JSON.stringify(op));
  } catch {
    active = false;
    message('Permite el almacenamiento de este navegador para guardar la billetera y el comprobante.');
    return;
  }
  pending = op;
  message('Confirmando tu apuesta…');
  renderQuote();
  try {
    if (!view?.wallet) {
      view = (await api({ type: 'join' }, op.marketId)).view;
      $('balance').textContent = 'Saldo · ' + chips(view.wallet.available);
    }
    const { result, view: next } = await api(op, op.marketId);
    if (result.filled !== op.qty || result.remaining !== 0 || !Number.isInteger(result.cost)) throw Error();
    sessionStorage.removeItem(pendingKey);
    pending = null;
    view = next;
    submitReceipt = '<strong>Apuesta confirmada.</strong> ' + esc(outcomeText(op.outcome)) + ' · ' + n(result.filled) +
      (result.filled === 1 ? ' participación' : ' participaciones') + ' por ' + chips(result.cost) + ' en total. ' +
      '<a href="/bolsa?vista=mis-apuestas">Ver mis apuestas</a>';
    render();
  } catch (error) {
    if (error.status >= 400 && error.status < 500) {
      sessionStorage.removeItem(pendingKey);
      pending = null;
      message(esc(error.message) + ' <button class="minor" type="button" data-action="refresh">Actualizar precios</button>');
    } else {
      showPending();
    }
  } finally {
    active = false;
    renderQuote();
  }
}

document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.action === 'refresh') { submitReceipt = ''; void refresh(); }
  if (button.dataset.action === 'retry' && pending) void send(pending);
  if (button.dataset.qty) {
    qtyText = button.dataset.qty;
    $('quantity').value = qtyText;
    renderQuote();
  }
});
document.addEventListener('change', event => {
  if (event.target.name !== 'lado') return;
  side = event.target.value;
  const url = new URL(location.href);
  url.searchParams.set('lado', side);
  history.replaceState(null, '', url);
  renderQuote();
});
document.addEventListener('input', event => {
  if (event.target.id !== 'quantity') return;
  qtyText = event.target.value;
  renderQuote();
});
document.addEventListener('submit', event => {
  if (event.target.id !== 'ticket') return;
  event.preventDefault();
  renderQuote();
  if (pending || !quote || $('confirm').disabled) return;
  void send({ type: 'bet', marketId, outcome: side, qty: quote.qty, maxPrice: quote.maxPrice, nonce: crypto.randomUUID() });
});

async function loadTeamNames() {
  try {
    const response = await fetch('/api/terminal', { signal: AbortSignal.timeout(10000) });
    if (!response.ok) return;
    for (const team of (await response.json()).teams || []) if (team.name && team.name !== team.team) teams.set(team.team, team.name);
    if (view && !marketId) render();
  } catch { /* Questions can use the official team slug when names are unavailable. */ }
}
function directoryState(v) {
  return JSON.stringify(v.markets.filter(isSimple).map(m => [m.id, m.status, m.bestBid, m.bestAsk, m.payout]));
}

// A background read never changes the price limit in a live ticket. The server
// can fill at that limit or better; the user requests a fresh ticket explicitly.
async function pulse() {
  if (document.hidden || !view || pulsing || active || fetching || Date.now() - lastRead < 55000) return;
  const start = revision;
  pulsing = true;
  try {
    const next = await api();
    if (start !== revision || active || document.hidden) return;
    lastRead = Date.now();
    clockOffset = (next.serverTs || lastRead) - lastRead;
    if (marketId && view.market.status === 'open' && next.market.status === 'open') {
      const changed = ['yes', 'no'].some(s => JSON.stringify(levelsFor(view, s)) !== JSON.stringify(levelsFor(next, s)));
      const mark = $('quote-update');
      if (mark) mark.textContent = changed
        ? 'Hay ofertas nuevas. Actualiza los precios para volver a calcular tu apuesta.'
        : 'Precios verificados el ' + when(next.serverTs) + '.';
      if (next.fills.length && JSON.stringify(next.fills) !== JSON.stringify(view.fills)) {
        view.fills = next.fills;
        renderChart();
      }
      return;
    }
    const changed = marketId ? view.market.status !== next.market.status :
      directoryState(view) !== directoryState(next) || (account && JSON.stringify(view.wallet) !== JSON.stringify(next.wallet));
    const focusHref = document.activeElement?.closest('#content a')?.href;
    view = next;
    $('balance').textContent = next.wallet ? 'Saldo · ' + chips(next.wallet.available) : '';
    if (changed) {
      render();
      if (focusHref) [...document.querySelectorAll('#content a')].find(a => a.href === focusHref)?.focus({ preventScroll: true });
    }
  } catch {
    const mark = $('quote-update');
    if (start === revision && mark) mark.textContent = 'No se pudo actualizar. Sigues viendo los precios del ' + when(view.serverTs) + '.';
  } finally {
    pulsing = false;
  }
}
setInterval(pulse, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) void pulse(); });
void refresh();
if (!marketId) void loadTeamNames();
