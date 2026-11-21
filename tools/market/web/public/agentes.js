const byId = (id) => document.getElementById(id);
const walletKey = 'mesa26.exchange.wallet.v1';
const visitorKey = 'mesa26.exchange.visitor.v1';
const endpoint = location.origin + '/api/exchange';
const labels = { read: 'Solo consultar', trade: 'Consultar y operar' };
const format = new Intl.DateTimeFormat('es-CL', {
  timeZone: 'America/Santiago', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
});
let joined = false;
let sessions = null;
let issuedId = null;
let busy = false;

function hex(bytes) {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (n) => n.toString(16).padStart(2, '0')).join('');
}
function savedKey(key, bytes, create) {
  const value = localStorage.getItem(key);
  if (value !== null) {
    if (value.length === bytes * 2 && /^[0-9a-f]+$/.test(value)) return value;
    throw Error('La clave guardada en este navegador es inválida.');
  }
  if (!create) return null;
  const fresh = hex(bytes);
  localStorage.setItem(key, fresh);
  return fresh;
}
function notice(message) { byId('notice').textContent = message; }
function clearSecret() {
  byId('issued-token').value = '';
  byId('issued').hidden = true;
  issuedId = null;
}
async function request(path, wallet, body, extraHeaders = {}) {
  const response = await fetch(path, {
    method: body ? 'POST' : 'GET', mode: 'same-origin', credentials: 'omit', cache: 'no-store', redirect: 'error',
    headers: { Authorization: 'Bearer ' + wallet, ...(body ? { 'Content-Type': 'application/json' } : {}), ...extraHeaders },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const value = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(Error(value.error || 'No se pudo conectar con la bolsa.'), { status: response.status });
  return value;
}
function renderSessions() {
  const list = byId('sessions');
  list.replaceChildren();
  if (!sessions) {
    list.textContent = 'Actualiza para consultar tus accesos.';
    return;
  }
  sessions = sessions.filter((session) => session.expiresAt > Date.now());
  if (issuedId && !sessions.some((session) => session.id === issuedId)) clearSecret();
  if (!sessions.length) list.textContent = 'Aún no tienes accesos activos.';
  for (const session of sessions) {
    const row = document.createElement('div');
    row.className = 'rd-row';
    const description = document.createElement('div');
    description.textContent = labels[session.scope] + ' · ' + session.id.slice(0, 8);
    const expires = document.createElement('span');
    expires.className = 'rd-note';
    expires.textContent = 'Vence el ' + format.format(session.expiresAt) + ' (Chile)';
    description.append(expires);
    const revoke = document.createElement('button');
    revoke.type = 'button';
    revoke.className = 'rd-button rd-button--quiet rd-button--small';
    revoke.textContent = 'Revocar';
    revoke.setAttribute('aria-label', 'Revocar acceso ' + session.id.slice(0, 8));
    revoke.disabled = busy;
    revoke.addEventListener('click', () => task(async () => {
      await request('/api/agent-sessions', savedKey(walletKey, 32, false), { action: 'revoke', id: session.id });
      sessions = sessions.filter((entry) => entry.id !== session.id);
      notice('Acceso revocado.');
    }));
    row.append(description, revoke);
    list.append(row);
  }
}
async function refresh() {
  const wallet = savedKey(walletKey, 32, false);
  if (wallet) {
    try {
      sessions = (await request('/api/agent-sessions', wallet)).sessions;
      joined = true;
    } catch (err) {
      if (err.status !== 403) throw err;
      joined = false;
    }
  } else joined = false;
  if (!joined) sessions = [];
  byId('first-wallet').hidden = joined;
}
async function task(fn) {
  if (busy) return;
  busy = true;
  byId('create').disabled = byId('refresh').disabled = true;
  notice('');
  try { await fn(); }
  catch (err) { notice(err.message || 'No se pudo completar la solicitud.'); }
  finally {
    busy = false;
    byId('create').disabled = byId('refresh').disabled = false;
    renderSessions();
  }
}
function updateScope() {
  const trade = byId('scope').value === 'trade';
  byId('scope-detail').textContent = trade
    ? 'Puede apostar fichas, enviar órdenes y cancelar órdenes abiertas de tu billetera.'
    : 'Puede ver tu saldo, posiciones, órdenes y los precios de la bolsa.';
  byId('prompt').value = 'Lee la guía en ' + location.origin + '/exchange.md. Usa la clave MESA26_AGENT_TOKEN de tus secretos con el encabezado Authorization: Bearer únicamente en ' + endpoint + '. Consulta mi saldo, posiciones y mercados con GET. '
    + (trade ? 'Opera con fichas del juego según mis instrucciones y verifica cada recibo. Para reintentar una operación usa el mismo nonce.' : 'Este acceso es de solo lectura.')
    + ' Mantén la clave fuera del chat y de los registros.';
}
byId('access-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const scope = byId('scope').value;
  task(async () => {
    const wallet = savedKey(walletKey, 32, true);
    if (!joined) {
      await request('/api/exchange', wallet, { type: 'join' }, { 'X-Exchange-Visitor': savedKey(visitorKey, 16, true) });
      joined = true;
      byId('first-wallet').hidden = true;
    }
    const { session, token } = await request('/api/agent-sessions', wallet, { action: 'create', scope });
    sessions = [session, ...(sessions ?? [])];
    issuedId = session.id;
    byId('issued-token').value = token;
    byId('issued-expiry').textContent = labels[scope] + ' · Vence el ' + format.format(session.expiresAt) + ' (Chile).';
    byId('issued').hidden = false;
    byId('issued-title').focus();
    notice('Acceso creado.');
  });
});
async function copy(id, success) {
  const field = byId(id);
  if (!field.value) return;
  try { await navigator.clipboard.writeText(field.value); notice(success); }
  catch {
    field.focus();
    field.select();
    notice('Texto seleccionado. Usa la opción Copiar de tu dispositivo.');
  }
}
byId('copy-endpoint').addEventListener('click', () => copy('endpoint', 'Dirección copiada.'));
byId('copy-prompt').addEventListener('click', () => copy('prompt', 'Instrucciones copiadas.'));
byId('copy-token').addEventListener('click', () => copy('issued-token', 'Clave copiada.'));
byId('hide-token').addEventListener('click', () => { clearSecret(); notice('Clave oculta.'); });
byId('refresh').addEventListener('click', () => task(refresh));
byId('scope').addEventListener('change', updateScope);
byId('endpoint').value = endpoint;
window.addEventListener('pagehide', clearSecret);
window.addEventListener('pageshow', (e) => { if (e.persisted) task(refresh); });
window.addEventListener('storage', (e) => { if (e.key === walletKey || e.key === null) { clearSecret(); task(refresh); } });
setInterval(() => {
  if (!busy && sessions?.some((session) => session.expiresAt <= Date.now())) renderSessions();
}, 30000);
updateScope();
task(refresh);
