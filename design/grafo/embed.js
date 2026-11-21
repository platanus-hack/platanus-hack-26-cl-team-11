/*
 * Montu · el globo, incrustado en otra página. globo.html carga este archivo solo si la dirección trae ?embed:
 *
 *   <iframe src="../grafo/globo.html?embed"></iframe>
 *
 * No cambia cómo se dibuja el globo aprobado. Hace tres cosas alrededor:
 *   1. Deja solo la esfera: sin barra, titular ni columna, con fondo transparente y encuadrada al marco.
 *   2. Un equipo de diez que conversa sin parar: tres grupos nacen, acuerdan y renacen con otras personas.
 *   3. Le cuenta cada acuerdo a la página que lo incrusta (postMessage) y escucha sus mensajes.
 *
 * Mensajes que salen:  { ronda: 'globo', type: 'listo' | 'acuerdo', tema, conversaciones, personas }
 * Mensajes que entran: { ronda: 'pagina', type: 'aceptar' }            tu grupo cierra el acuerdo y abre el tema siguiente
 *                      { ronda: 'pagina', type: 'pausa', valor: true }  detiene las conversaciones; el globo se sigue girando
 *                      { ronda: 'pagina', type: 'velocidad', valor: 2 } apura la demo (1, 2, 4)
 *                      { ronda: 'pagina', type: 'adelantar' }           corre hasta el próximo acuerdo
 * Otros parámetros:    ?marco=340 y ?ancho=420 (medio alto y medio ancho del encuadre, en unidades del lienzo)
 *                      y los del globo (?still, ?luz=0).
 */
(function () {
  'use strict';
  if (typeof g === 'undefined') return;

  var query = new URLSearchParams(location.search);
  var page = window.parent !== window ? window.parent : null;
  var tell = function (type, data) {
    if (!page) return;
    var message = { ronda: 'globo', type: type };
    for (var key in data) message[key] = data[key];
    page.postMessage(message, '*');
  };

  /* ---------- 1. Solo la esfera ---------- */
  var CENTER_X = 590, CENTER_Y = 545, HALF_Y = Number(query.get('marco')) || 340, HALF_X = Number(query.get('ancho')) || HALF_Y;
  var style = document.createElement('style');
  style.textContent =
    'html, body { height: 100%; overflow: hidden; background: transparent; }' +
    '.rd-page { min-height: 0; height: 100%; overflow: hidden; background: transparent; }' +
    '.globo { margin: 0; transform-origin: 0 0; }' +
    '.globo > .rd-aura, .globo .rd-bar, .globo .rd-hero, .globo aside, #thread-view { display: none !important; }';
  document.head.appendChild(style);
  var stage = document.querySelector('.globo');
  var fit = function () {
    var width = window.innerWidth, height = window.innerHeight, scale = Math.min(width / (HALF_X * 2), height / (HALF_Y * 2));
    stage.style.transform = 'translate(' + (width / 2 - CENTER_X * scale).toFixed(2) + 'px, ' + (height / 2 - CENTER_Y * scale).toFixed(2) + 'px) scale(' + scale.toFixed(4) + ')';
  };
  window.addEventListener('resize', fit);
  fit();

  /* ---------- 2. Diez personas que conversan sin parar ---------- */
  // Cada grupo recorre sus turnos: mismas reglas de vida del globo (nace, negocia, acuerda), otra gente cada vez.
  var TEAM_SIZE = 10;
  var ROUNDS = [
    { id: 'ronda-a', offset: 5, turns: [
      { members: [3, 4], edges: [[3, 4, 1]], topic: 'Plan B para el cliente' },
      { members: [4, 7, 2], edges: [[4, 7, 1], [4, 2, 1], [7, 2, 2]], topic: 'Turno del sábado' },
      { members: [3, 5], edges: [[3, 5, 1]], topic: 'Llaves de la oficina' },
      { members: [7, 4, 3], edges: [[7, 4, 1], [7, 3, 1], [4, 3, 2]], topic: 'Almuerzo del equipo' }
    ] },
    { id: 'ronda-b', offset: 2.4, turns: [
      { members: [5, 8, 7], edges: [[5, 8, 1], [5, 7, 1], [8, 7, 2]], topic: 'Mover la reunión del lunes' },
      { members: [8, 3], edges: [[8, 3, 1]], topic: 'Revisar el contrato' },
      { members: [5, 6, 9], edges: [[5, 6, 1], [5, 9, 1], [6, 9, 2]], topic: 'Bug de pagos' },
      { members: [8, 5], edges: [[8, 5, 1]], topic: 'Quién lleva al cliente' }
    ] },
    { id: 'ronda-c', offset: 9.5, turns: [
      { members: [6, 1, 9], edges: [[6, 1, 1], [6, 9, 1], [1, 9, 2]], topic: 'Datos para el pitch' },
      { members: [9, 6], edges: [[9, 6, 1]], topic: 'Fotos del equipo' },
      { members: [6, 2], edges: [[6, 2, 1]], topic: 'Reserva de la sala' },
      { members: [1, 6, 5], edges: [[1, 6, 1], [1, 5, 1], [6, 5, 2]], topic: 'Guion de la demo' }
    ] }
  ];
  var MINE_NOW = { topic: 'Cubrir la reunión de las 11', edges: [[0, 1, 1, '¿Quién cubre las 11?'], [0, 2, 1], [1, 2, 2, 'Review antes de las 10:30']] };
  var MINE_NEXT = { topic: 'Ensayar el pitch del domingo', status: 'Prepara el pitch', edges: [[0, 2, 1, 'Ensayo a las 16:00'], [0, 1, 1], [2, 1, 2, 'Slides antes de las 15:00']] };
  var openNext = function (group) { group.edges = MINE_NEXT.edges; group.topic = MINE_NEXT.topic; g.people[0].status = MINE_NEXT.status; };

  var builtIn = { buildGroups: g.buildGroups, pickMembers: g.pickMembers, phase: g.phase, frame: g.frame };

  // El reloj de la demo: el globo recibe un tiempo propio, que se puede detener, apurar o adelantar.
  var SPRINT = 8, SPRINT_LIMIT = 2500;
  var clock = { real: performance.now(), demo: performance.now(), speed: 1, paused: false, sprintUntil: 0 };
  g.frame = function (now) {
    var step = Math.min(100, Math.max(0, now - clock.real));
    clock.real = now;
    clock.demo += step * (now < clock.sprintUntil ? SPRINT : clock.paused ? 0 : clock.speed);
    return builtIn.frame.call(this, clock.demo);
  };
  var scripted = function () { return g.state.n === TEAM_SIZE; };

  g.pickMembers = function (group, n, cycle) {
    if (!group.turns) return builtIn.pickMembers.call(this, group, n, cycle);
    var turn = group.turns[((cycle % group.turns.length) + group.turns.length) % group.turns.length];
    group.members = turn.members; group.edges = turn.edges; group.topic = turn.topic; group.cycle = cycle;
  };
  g.buildGroups = function (n) {
    if (n !== TEAM_SIZE) return builtIn.buildGroups.call(this, n);
    var self = this, now = this.nowT || 0;
    var groups = [{ id: 'mia', mine: true, members: [0, 1, 2], edges: MINE_NOW.edges, topic: MINE_NOW.topic, offset: 0 }];
    ROUNDS.forEach(function (round, index) {
      var group = { id: round.id, seed: index, turns: round.turns, offset: round.offset };
      self.pickMembers(group, n, Math.floor((now + round.offset) / self.PERIOD));
      groups.push(group);
    });
    this.groups = groups;
  };

  // Tu grupo: negocia hasta que aceptas. Entonces recoge sus hilos, dice «Listo» y abre el tema siguiente.
  var acceptedAt = null;
  var rise = function (x) { x = Math.max(0, Math.min(1, x)); return 1 - Math.pow(1 - x, 3); };
  g.phase = function (group, t) {
    if (group.mine && acceptedAt !== null && !this.reduced) {
      var local = t - acceptedAt;
      if (local < 2.6) return { t1: 1, t2: 1, live: 0, agree: local / 2.6, alpha: 1 };
      if (local < 4.4) return { t1: 0, t2: 0, live: 0, agree: 0, alpha: 0 };
      if (group.edges !== MINE_NEXT.edges) openNext(group);
      var born = local - 4.4;
      if (born < 3) return { t1: rise(born / 1.3), t2: rise((born - 1.4) / 1.3), live: born > 1.3 ? 1 : 0, agree: 0, alpha: 1 };
      acceptedAt = null;
    }
    return builtIn.phase.call(this, group, t);
  };
  window.addEventListener('message', function (event) {
    var data = event.data;
    if (!data || data.ronda !== 'pagina') return;
    if (data.type === 'pausa') clock.paused = !!data.valor;
    if (data.type === 'velocidad') clock.speed = Math.max(0.25, Math.min(8, Number(data.valor) || 1));
    if (data.type === 'adelantar' && !g.reduced) clock.sprintUntil = performance.now() + SPRINT_LIMIT;
    if (data.type !== 'aceptar') return;
    var mine = g.groups.filter(function (group) { return group.mine; })[0];
    if (!mine || mine.edges === MINE_NEXT.edges) return;
    if (g.reduced) { openNext(mine); return; }
    acceptedAt = g.nowT || 0;
  });

  if (!query.has('n')) g.setN(TEAM_SIZE, false);
  else { g.buildGroups(g.state.n); g.setState({ auto: false, groupCount: g.groups.length }); }

  /* ---------- 3. Lo que pasa adentro, hacia afuera ---------- */
  var told = {};
  var nameOf = function (index) { return g.people[index].name; };
  var watch = function () {
    var t = g.nowT || 0;
    g.groups.forEach(function (group) {
      if (group.mine || group.offset === undefined) return;
      var turn = Math.floor((t + group.offset) / g.PERIOD), local = (t + group.offset) % g.PERIOD;
      if (local < 11 || told[group.id] === turn) return;
      told[group.id] = turn;
      clock.sprintUntil = 0;
      tell('acuerdo', { tema: group.topic, conversaciones: group.edges.length, personas: group.members.map(nameOf) });
    });
  };
  var still = g.reduced || query.has('still');
  var loop = function (now) {
    if (!still) watch();
    window.requestAnimationFrame(loop);
  };
  window.requestAnimationFrame(loop);
  tell('listo', { personas: g.state.n, grupos: g.groups.length });
})();
