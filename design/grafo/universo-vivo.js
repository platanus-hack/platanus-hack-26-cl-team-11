// Montu · Universo en vivo: la ronda real de la mesa pública, con el mismo globo y el mismo hilo de la demo.
// Lo carga universo.html?vivo=/api/people/<token>/mesa/live. Nada es inventado: personas, pedidos,
// conversaciones y propuestas vienen del servidor. El texto de una conversación llega solo a sus dos
// dueños; el resto ve quién le escribe a quién, el tema y el resultado, con la marca «dato privado».
// Cada pedido de la ronda es una escena: quien pide al frente y, a medida que su agente escribe, quienes responden.
// Cada paso real de un agente (revisar lo que publicó la mesa, leer si su persona puede ayudar, redactar la
// propuesta) abre su tarjeta de herramienta cuando empieza y la cierra cuando termina, con su miniatura en el arco.
// Mientras el modelo escribe un mensaje, el servidor entrega lo que lleva escrito: la burbuja crece con ese texto.
(function () {
  var query = new URLSearchParams(location.search);
  var source = query.get('vivo') || '';
  var CLEAN = query.has('limpio');
  var SCRIPTED = query.has('guion');
  if (source.indexOf('/api/people/') !== 0 || !LIVE) return;

  var RUNNING_MS = 350, IDLE_MS = 4000, URGENT_MS = 90000, RECENT_MS = 120000;
  var GAP = 0.4, HOLD = 2.4, TYPE_RATE = 40, READ_RATE = 55, READ_BASE = 1.6, LONGEST_READ = 8, SCAN_STEP = 2.6, TILES = 64, MAX_STRIDE = 4, LOBBY_ROWS = 8, EXPECTED_STEP = 4, SHORTEST_STEP = 1.2, TILE_PX = 120;
  var BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
  var HELP = { si: 'Puede ayudar.', parcial: 'Puede orientar.', no: 'No puede esta vez.' };
  var ROLE = { si: 'Puede ayudar', parcial: 'Puede orientar', no: 'No puede' };
  var KNOWS = { si: 'Sabe', parcial: 'Sabe algo', no: 'No sabe' };
  var CLOSED = {
    nadie: ['Nadie más está en este tema', 'Lo vuelven a intentar la próxima vez'],
    sin_ayuda: ['Nadie puede ayudar por ahora', 'Lo vuelven a intentar la próxima vez'],
    falla: ['El modelo no respondió', 'Lo vuelven a intentar la próxima vez']
  };
  // Cómo terminó cada conversación, en una frase que se entiende sola.
  var ENDED = {
    nadie: function (name) { return 'Nadie más estaba en algo parecido a lo de ' + name; },
    sin_respuesta: function (name) { return 'Nadie tenía algo sobre la pregunta de ' + name; },
    sin_ayuda: function (name) { return 'Le escribieron a otros por lo de ' + name + ', pero nadie podía ahora'; },
    falla: function (name) { return 'El agente de ' + name + ' no alcanzó a conversar'; }
  };

  var slotOf = new Map(), needs = [], byKey = new Map();
  var seen = 0, current = null, held = [], holding = false, releaseAt = Infinity, flying = false, cleaning = CLEAN, PAGE = 200, SETTLE = 3;
  var arriving = [], since = 0, running = false, finished = null, showing = null, summarized = true, loaded = false, stride = 1, urgentUntil = 0, timer = 0;

  // Tres estados: listos (nadie conversa), conversando (un hilo a la vez) y resumen (quién ayuda a quién).
  document.getElementById('step0').textContent = 'Listos';
  document.getElementById('step1').firstChild.textContent = 'Conversando ';
  document.getElementById('step2').textContent = 'Resumen';
  var tag = document.querySelector('.uv-top .rd-tag');
  if (tag) tag.textContent = 'En vivo';

  var count = function (n, one, many) { return n.toLocaleString('es-CL') + ' ' + (n === 1 ? one : many); };
  var agentOf = function (slot) { return slot === 0 ? 'Tu agente' : 'El agente de ' + people[slot].name; };
  var askOf = function (slot) { return slot === 0 ? 'Tu pedido' : 'Pedido de ' + people[slot].name; };
  var tileOf = function (id) { var h = 0; for (var i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0; return h % TILES; };

  // Cada persona real ocupa un lugar de la esfera; quien mira va en el 0, que es «Tú».
  function seat(person, mine) {
    if (slotOf.has(person.id)) return;
    var slot = -1, k;
    if (mine) slot = 0;
    else {
      for (k = stride; k < U.N && slot < 0; k += stride) if (!LIVE.on[k]) slot = k;
      for (k = 1; k < U.N && slot < 0; k++) if (!LIVE.on[k]) slot = k;
    }
    if (slot < 0) return;
    slotOf.set(person.id, slot);
    LIVE.on[slot] = true;
    people[slot] = { name: person.name, face: 'tile:' + tileOf(person.id), stats: person.stats || null };
  }

  function needOf(ev) {
    var key = ev.from + '|' + ev.topic, need = byKey.get(key);
    if (need) return need;
    var from = slotOf.get(ev.from);
    if (from === undefined) return null;
    var g = { members: [from], topic: ev.topic }, script = { events: [], duration: Infinity };
    SHOWN.push(g); SCRIPTS.push(script); SCENES.push({ kind: 'group', i: SHOWN.length - 1, dur: Infinity });
    need = { ask: !!ev.ask, from: from, g: g, script: script, scene: SCENES.length - 1, queue: [], closed: false, outcome: null, done: false, next: 0, lastEnd: 0, threads: 0, answers: {}, steps: {}, live: {}, said: {} };
    needs.push(need); byKey.set(key, need);
    return need;
  }

  function idle(step, title, sub, rows) { LIVE.step = step; LIVE.title = title; LIVE.sub = sub; LIVE.rows = rows || []; startScene(0); }

  function lobby() {
    var seated = [];
    slotOf.forEach(function (slot) { seated.push(slot); });
    seated.sort(function (a, b) { return a - b; });
    idle(0, count(seated.length, 'agente', 'agentes'), 'Listos para conversar. Gira el globo y toca una cara para ver quién es.', seated.slice(0, LOBBY_ROWS).map(function (slot) {
      return { faces: [slot], title: slot === 0 ? 'Tú' : people[slot].name, sub: slot === 0 ? 'Tu agente' : 'Su agente' };
    }));
  }

  function reset() {
    needs = []; byKey = new Map(); finished = null; summarized = false; showing = null; LIVE.scan = null;
    SHOWN.length = 0; SCRIPTS.length = 0; SCENES.length = 1;
    idle(1, 'Conversando', 'Los agentes leen lo que cada persona publicó');
  }

  function summary(title) {
    summarized = true;
    var threads = needs.reduce(function (total, need) { return total + need.threads; }, 0);
    var proposals = needs.filter(function (need) { return need.outcome === 'propuesta'; }).length;
    var answers = needs.filter(function (need) { return need.outcome === 'respuesta'; }).length;
    var parts = [count(threads, 'conversación', 'conversaciones'), answers && !proposals ? count(answers, 'respuesta', 'respuestas') : count(proposals, 'propuesta', 'propuestas')];
    idle(2, title, needs.length ? parts.join(' · ') : 'Nadie tenía un pedido abierto', needs.map(function (need) {
      var name = need.from === 0 ? 'ti' : people[need.from].name;
      var answered = need.outcome === 'respuesta';
      var agreed = need.outcome === 'propuesta' || answered;
      var helpers = (need.helpers || []).map(function (id) { var slot = slotOf.get(id); return slot === undefined ? null : slot === 0 ? 'Tú' : people[slot].name; }).filter(Boolean);
      var who = helpers.length > 1 ? helpers.slice(0, -1).join(', ') + ' y ' + helpers[helpers.length - 1] : helpers[0];
      var verb = answered ? (helpers.length > 1 ? 'respondieron' : who === 'Tú' ? 'respondiste' : 'respondió') : helpers.length > 1 ? 'ayudan' : who === 'Tú' ? 'ayudas' : 'ayuda';
      var title = agreed && who ? (name === 'ti' ? who + ' te ' + verb : who + ' ' + verb + ' a ' + name) : agreed ? 'Quedó una propuesta para ' + name : (ENDED[need.ask && need.outcome === 'nadie' ? 'sin_respuesta' : need.outcome] || ENDED.falla)(name);
      return { faces: need.g.members, title: title, sub: agreed && need.proposal ? need.g.topic + ' · ' + need.proposal : need.g.topic, check: agreed };
    }));
  }

  // Una ronda que ya terminó hace rato no se reproduce: se muestra cómo quedó.
  function settle(need) {
    need.queue.forEach(function (ev) {
      var helper = slotOf.get(ev.to);
      if (ev.type === 'hilo_abre') { need.threads += 1; if (helper !== undefined && need.g.members.indexOf(helper) < 0) need.g.members.push(helper); }
      else if (ev.type === 'propuesta_nace') { need.helpers = ev.helpers || []; need.proposal = ev.text || null; }
      else if (ev.type === 'pedido_cierra') { need.outcome = ev.outcome; if (ev.outcome === 'respuesta') { need.helpers = ev.helpers || []; need.proposal = ev.text || null; } }
    });
    need.queue = []; need.closed = true; need.done = true;
  }

  // Bajo cada cara del encabezado: quien pide, a quién ya le escribieron y qué respondió su agente.
  LIVE.roleOf = function (slot, position) {
    if (position === 0) return showing && showing.ask ? 'Pregunta' : 'Pide ayuda';
    var said = showing && showing.answers[slot];
    if (showing && showing.ask) return said ? KNOWS[said] || 'Respondió' : 'Le preguntaron';
    return said ? ROLE[said] || 'Respondió' : 'Le escribieron';
  };
  function heading(need) { header(need.g.topic, agentOf(need.from) + (need.ask ? ' pregunta' : ' pide ayuda'), need.g.members); }

  function show(need) {
    showing = need; LIVE.step = 1;
    startScene(need.scene);
    heading(need);
    push(need.ask ? pairRow([need.from], agentOf(need.from) + ' le pregunta a cada agente', 'Cada uno responde con lo que su persona comparte') : pairRow([need.from], agentOf(need.from) + ' busca a quién escribirle', 'Revisa lo que publicó cada persona'));
    need.lastEnd = clock + 0.8; need.next = clock + 1.1;
    need.scanned = 0; need.scanAt = clock + 0.6;
    LIVE.scan = { from: need.from, to: null, at: clock };
  }

  // Mientras el agente todavía no conversa con nadie, recorre la mesa: una persona a la vez y después todas.
  function scan(need) {
    if (need.started || need.closed) { LIVE.scan = null; return; }
    if (clock < need.scanAt) return;
    var others = [];
    slotOf.forEach(function (slot) { if (slot !== need.from) others.push(slot); });
    others.sort(function (a, b) { return a - b; });
    need.scanAt = clock + SCAN_STEP;
    if (need.scanned >= others.length) { if (LIVE.scan.to !== null) { LIVE.scan = { from: need.from, to: null, at: clock }; turnTo([need.from].concat(others)); } return; }
    var other = others[need.scanned++];
    LIVE.scan = { from: need.from, to: other, at: clock };
    turnTo([need.from, other]);
    push(pairRow([other], people[other].name, need.ask ? 'Su agente revisa si sabe algo' : 'Su agente revisa si puede ayudar'));
  }

  function say(need, from, to, text, quick) {
    var at = Math.max(clock, need.next), end = at + (quick ? 0.9 : 1 + text.length / TYPE_RATE), read = quick ? 0.5 : Math.min(LONGEST_READ, READ_BASE + text.length / READ_RATE);
    need.script.events.push({ type: 'message', from: from, to: to, at: at, end: end, text: text });
    need.lastEnd = end + read; need.next = end + read;
  }

  function note(need, faces, title, sub, check) {
    var row = pairRow(faces, title, sub, check);
    row.setAttribute('data-full', '');
    push(row);
    var read = Math.min(LONGEST_READ, READ_BASE + (sub || '').length / READ_RATE);
    need.lastEnd = clock + read; need.next = clock + read;
  }

  // La cara de una persona real, recortada del atlas, para la ilustración de una tarjeta.
  var faceUrls = {};
  function faceUrlOf(slot) {
    if (faceUrls[slot]) return faceUrls[slot];
    if (!atlas.complete || !atlas.naturalWidth) return BLANK;
    var tile = +people[slot].face.slice(5), canvas = document.createElement('canvas');
    canvas.width = canvas.height = TILE_PX;
    canvas.getContext('2d').drawImage(atlas, (tile % 8) * 128 + 4, Math.floor(tile / 8) * 128 + 4, TILE_PX, TILE_PX, 0, 0, TILE_PX, TILE_PX);
    return (faceUrls[slot] = canvas.toDataURL('image/png'));
  }

  // Los tres pasos reales de una ronda, con la tarjeta que ya existe para cada uno.
  var STEPS = {
    'equipo.consultar': function (need, by, ev) {
      var others = [];
      slotOf.forEach(function (slot) { if (slot !== by) others.push(slot); });
      return { motion: 'help', does: ' revisa la mesa', label: 'Revisar lo que publicó cada persona', receipt: 'Listo', input: { tema: need.g.topic }, output: { personas: ev.people }, faces: others.slice(0, 5).map(faceUrlOf), to: need.g.members[1] === undefined ? by : need.g.members[1] };
    },
    'agenda.cruzar': function (need, by, ev) {
      var others = [];
      slotOf.forEach(function (slot) { if (slot !== by) others.push(slot); });
      return { motion: 'calendars', does: ' cruza las agendas', label: 'Cruzar las agendas del equipo', receipt: 'Listo', input: { tema: need.g.topic }, output: { agendas: ev.agendas }, faces: others.slice(0, 5).map(faceUrlOf), to: need.g.members[1] === undefined ? by : need.g.members[1] };
    },
    'tablero.responder': function (need, by, ev) {
      return { motion: 'guideline', does: ' arma la respuesta', label: 'Juntar lo que respondió cada agente', receipt: 'Lista', input: { respuestas: ev.answers }, output: { respuesta: true }, to: need.g.members[1] === undefined ? by : need.g.members[1] };
    },
    'checkin.consultar': function (need, by) {
      return { motion: 'health', does: ' lee a su persona', label: 'Revisar si ' + people[by].name + ' puede ayudar', receipt: 'Solo para su agente', privateResult: true, input: { tema: need.g.topic }, output: { compartir: false }, faces: [faceUrlOf(by)], to: need.from };
    },
    'propuesta.redactar': function (need, by, ev) {
      return { motion: 'guideline', does: ' redacta', label: 'Redactar la propuesta', receipt: 'Borrador listo', input: { ayudan: ev.willing }, output: { borrador: true }, to: need.g.members[1] === undefined ? by : need.g.members[1] };
    }
  };
  var RECEIPT = {
    'agenda.cruzar': function (ev) { return count(ev.agendas || 0, 'agenda revisada', 'agendas revisadas'); },
    'equipo.consultar': function (ev) { return ev.chosen ? count(ev.chosen, 'persona elegida', 'personas elegidas') : 'Nadie con relación'; }
  };

  function closeStep(call, receipt) {
    call.end = Math.max(clock, call.at + SHORTEST_STEP);
    if (!receipt) return;
    call.receipt = receipt;
    var shown = call.node && call.node.querySelector('.rt-done span');
    if (shown) shown.textContent = receipt;
  }

  function step(need, ev) {
    var by = slotOf.get(ev.by), key = ev.tool + '|' + ev.by, make = STEPS[ev.tool];
    if (by === undefined || !make) return;
    if (ev.state === 'inicio') {
      var at = Math.max(clock, need.next);
      var call = Object.assign(make(need, by, ev), { type: 'call', name: ev.tool, who: agentOf(by), from: by, at: at, end: at + EXPECTED_STEP });
      need.script.events.push(call); need.steps[key] = call;
      need.lastEnd = at + SHORTEST_STEP; need.next = at + 0.9;
    } else if (need.steps[key]) {
      var open = need.steps[key];
      delete need.steps[key];
      closeStep(open, RECEIPT[ev.tool] ? RECEIPT[ev.tool](ev) : '');
      need.lastEnd = open.end + 0.9; need.next = open.end + 0.7;
    }
  }

  // Un mensaje que el modelo está escribiendo ahora: nace con las primeras letras y crece en cada lectura.
  function writing(stream) {
    var need = byKey.get(stream.from + '|' + stream.topic), other = slotOf.get(stream.to), id = stream.kind + '|' + stream.to;
    if (!need || need !== showing || other === undefined || need.said[id]) return;
    var live = need.live[id];
    if (!live) {
      if (need.g.members.indexOf(other) < 0) { need.g.members.push(other); heading(need); turnTo(need.g.members); }
      live = need.live[id] = { text: '', done: false };
      live.ev = { type: 'message', from: stream.kind === 'ask' ? need.from : other, to: stream.kind === 'ask' ? other : need.from, at: clock, end: clock + EXPECTED_STEP, text: '', live: live };
      need.script.events.push(live.ev);
    }
    if (stream.text !== null) live.text = stream.text;
  }

  // El mensaje terminó: queda con su texto final (o como dato privado para quien no es parte).
  function settleLive(need, id, text) {
    var live = need.live[id];
    need.said[id] = true;
    if (!live) return false;
    live.text = text; live.done = true; live.ev.end = clock + 0.5;
    delete need.live[id];
    var read = Math.min(LONGEST_READ, READ_BASE + text.length / READ_RATE);
    need.lastEnd = clock + read; need.next = clock + read;
    return true;
  }

  function play(need, ev) {
    var other = slotOf.get(ev.to);
    need.started = true; LIVE.scan = null;
    if (ev.type === 'paso') return step(need, ev);
    if (ev.type === 'hilo_abre' && other !== undefined) {
      if (need.g.members.indexOf(other) < 0) { need.g.members.push(other); heading(need); turnTo(need.g.members); }
      need.threads += 1;
      if (!settleLive(need, 'ask|' + ev.to, ev.text || 'Le escribe por este pedido. [[x]]')) say(need, need.from, other, ev.text || 'Le escribe por este pedido. [[x]]', need.ask);
    } else if (ev.type === 'hilo_responde' && other !== undefined) {
      need.answers[other] = ev.help || 'si'; heading(need);
      if (!settleLive(need, 'reply|' + ev.to, ev.text || (HELP[ev.help] || 'Respondió.') + ' [[x]]')) say(need, other, need.from, ev.text || (HELP[ev.help] || 'Respondió.') + ' [[x]]', need.ask && ev.help === 'no');
    } else if (ev.type === 'propuesta_nace') {
      need.helpers = ev.helpers || []; need.proposal = ev.text || null;
      var helpers = (ev.helpers || []).map(function (id) { return slotOf.get(id); }).filter(function (slot) { return slot !== undefined; });
      var names = helpers.map(function (slot) { return people[slot].name; }).join(' y ');
      if (ev.scripted) ev.scripted();
      note(need, [need.from].concat(helpers), 'Propuesta', ev.text || names + (helpers.length === 1 ? ' ayuda a ' : ' ayudan a ') + people[need.from].name + '. Cada persona decide si acepta.', true);
    } else if (ev.type === 'pedido_cierra') {
      need.closed = true; need.outcome = ev.outcome;
      Object.keys(need.steps).forEach(function (key) { closeStep(need.steps[key], 'Sin respuesta'); });
      need.steps = {};
      Object.keys(need.live).forEach(function (id) { settleLive(need, id, need.live[id].text || 'Sin respuesta.'); });
      if (ev.outcome === 'respuesta') { need.helpers = ev.helpers || []; need.proposal = ev.text || null; note(need, need.g.members, 'Respuesta', ev.text || 'Llegó la respuesta.', true); }
      else if (CLOSED[ev.outcome]) note(need, [need.from], need.ask && ev.outcome === 'nadie' ? 'Nadie tenía algo que aportar' : CLOSED[ev.outcome][0], need.ask ? '' : CLOSED[ev.outcome][1]);
    }
  }

  // Un pedido a la vez: sus pasos entran al hilo en orden, cada uno cuando el anterior terminó de escribirse.
  LIVE.tick = function () {
    if (showing) {
      scan(showing);
      // Un paso entra apenas llega, para que su tarjeta quede antes del mensaje que sale de él.
      while (showing.queue.length && (clock >= showing.next || showing.queue[0].type === 'paso')) play(showing, showing.queue.shift());
      // Un paso que sigue esperando al modelo se queda «consultando»: su final se corre mientras no llegue la respuesta.
      Object.keys(showing.steps).forEach(function (key) { var open = showing.steps[key]; if (clock > open.end - 0.4) open.end = clock + 1.2; });
      arriving.forEach(writing); arriving = [];
      Object.keys(showing.live).forEach(function (id) { var live = showing.live[id]; if (clock > live.ev.end - 0.4) live.ev.end = clock + 1.2; });
      var over = (showing.closed || finished) && !showing.queue.length && clock > showing.lastEnd + HOLD;
      if (!over) return;
      showing.done = true; LIVE.scan = null;
      // El último pedido de la ronda se queda en pantalla, con toda su conversación, hasta que empiece otra.
      if (finished && !needs.some(function (need) { return !need.done; })) { showing = null; summarized = true; LIVE.step = 2; setSteps(); releaseAt = clock + SETTLE; return; }
      showing = null;
    }
    var next = needs.filter(function (need) { return !need.done; })[0];
    if (next) show(next);
    else if (finished && !summarized) { summary('Resumen'); releaseAt = clock + SETTLE; }
    else if (holding && (clock >= releaseAt || !finished)) release();
  };

  function release() {
    var waiting = held;
    held = []; holding = false; releaseAt = Infinity;
    waiting.forEach(handle);
  }

  function take(ev) {
    if (typeof ev.id === 'number') {
      if (ev.id <= seen) return;
      seen = ev.id;
    }
    handle(ev);
  }

  function handle(ev) {
    if (holding) { held.push(ev); return; }
    if (ev.type === 'ronda_empieza') {
      var playing = showing || needs.some(function (need) { return !need.done; }) || (needs.length > 0 && !summarized);
      if (playing) { holding = true; held.push(ev); return; }
      current = ev.round || null;
      reset();
      return;
    }
    if (ev.type === 'ronda_termina') {
      if (current === null || !ev.round || ev.round === current) finished = ev;
      return;
    }
    if (!ev.from || !ev.topic) return;
    var need = needOf(ev);
    if (need && ev.type !== 'pedido_busca') need.queue.push(ev);
  }

  function apply(data) {
    var first = !loaded;
    if (first) stride = Math.max(1, Math.min(MAX_STRIDE, Math.floor(U.N / Math.max(1, data.people.length))));
    data.people.forEach(function (person) { if (person.id === data.me) seat(person, true); });
    data.people.forEach(function (person) { seat(person, false); });
    loaded = true;
    if (SCRIPTED) { meId = data.me; data.people.forEach(function (person) { idByName[person.name] = person.id; if (person.id === data.me) meName = person.name.split(' ')[0]; }); running = false; if (first) lobby(); return; }
    if (cleaning && data.round && data.round.status === 'en_curso') cleaning = false;
    if (cleaning) {
      since = data.lastEventId || since;
      seen = Math.max(seen, since);
      running = false;
      if (data.events.length < PAGE) { cleaning = false; lobby(); }
      return;
    }
    data.events.forEach(take);
    arriving = data.streams || [];
    since = data.lastEventId || since;
    running = !!(data.round && data.round.status === 'en_curso');
    if (!first) return;
    var start = data.events.filter(function (ev) { return ev.type === 'ronda_empieza'; })[0];
    if (!start) lobby();
    else if (!running && Date.parse(data.now) - Date.parse(start.at) > RECENT_MS) { needs.forEach(settle); summary('Resumen'); }
  }

  // Con ?guion la conversación sigue un libreto fijo: tres escenas en orden, con las mismas tarjetas y arcos que una ronda real.
  var meId = null, meName = 'Tu persona', idByName = {}, sceneAt = 0, pending = null, round = 0;
  function idOf(name) {
    if (idByName[name]) return idByName[name];
    var other = null;
    slotOf.forEach(function (slot, id) { if (id !== meId && other === null) other = id; });
    return other;
  }
  function later(ms, ev) { setTimeout(function () { handle(ev); }, ms); }
  function askParent(decision) { parent.postMessage({ montu: 'guion-pide', decision: decision }, location.origin); }
  function sceneOf(topic, id) { later(0, { type: 'ronda_empieza', round: id }); return { from: meId, topic: topic }; }
  function closing(ms, base, id, outcome, extra) {
    later(ms, Object.assign({ type: 'pedido_cierra', outcome: outcome }, base, extra || {}));
    later(ms + 50, { type: 'ronda_termina', round: id });
  }
  function playQuestion(text) {
    var id = 'g' + ++round, base = Object.assign(sceneOf(text, id), { ask: true }), t = 5200;
    later(20, Object.assign({ type: 'pedido_busca' }, base));
    ['Robert', 'AMG', 'natochi'].forEach(function (name) {
      later(t, Object.assign({ type: 'hilo_abre', to: idOf(name), text: text }, base));
      later(t + 100, Object.assign({ type: 'hilo_responde', to: idOf(name), help: 'no', text: 'No tiene nada sobre eso.' }, base));
      t += 200;
    });
    later(t, Object.assign({ type: 'hilo_abre', to: idOf('Matías Berríos'), text: text }, base));
    later(t + 100, Object.assign({ type: 'hilo_responde', to: idOf('Matías Berríos'), help: 'si', text: 'Sí, Matías está construyendo el login con Google de la app de Vita. Ya funciona el inicio de sesión y le falta el cierre de sesión, que termina esta semana.' }, base));
    later(t + 200, Object.assign({ type: 'paso', tool: 'tablero.responder', by: meId, state: 'inicio', answers: 1 }, base));
    later(t + 2600, Object.assign({ type: 'paso', tool: 'tablero.responder', by: meId, state: 'fin', answers: 1 }, base));
    closing(t + 2700, base, id, 'respuesta', { helpers: [idOf('Matías Berríos')], text: 'Sí, Matías Berríos está construyendo el login con Google de la app de Vita. El inicio de sesión ya funciona y le falta el cierre de sesión, que termina esta semana.' });
  }
  function playNeed(plot) {
    var id = 'g' + ++round, base = sceneOf(plot.topic, id), t = 4200;
    later(20, Object.assign({ type: 'pedido_busca' }, base));
    later(t, Object.assign({ type: 'paso', tool: 'equipo.consultar', by: meId, state: 'inicio', people: 4 }, base));
    if (plot.agendas) later(t + 50, Object.assign({ type: 'paso', tool: 'agenda.cruzar', by: meId, state: 'inicio', agendas: 4 }, base));
    t += 3200;
    later(t, Object.assign({ type: 'paso', tool: 'equipo.consultar', by: meId, state: 'fin', people: 4, chosen: plot.contacts.length }, base));
    if (plot.agendas) later(t + 50, Object.assign({ type: 'paso', tool: 'agenda.cruzar', by: meId, state: 'fin', agendas: 4 }, base));
    plot.contacts.forEach(function (contact, position) {
      var to = idOf(contact.name), start = t + 200 + position * 150;
      later(start, Object.assign({ type: 'hilo_abre', to: to, text: contact.ask.split('{yo}').join(meName) }, base));
      later(start + 60, Object.assign({ type: 'paso', tool: 'checkin.consultar', by: to, state: 'inicio' }, base));
      later(start + 2600, Object.assign({ type: 'paso', tool: 'checkin.consultar', by: to, state: 'fin' }, base));
      later(start + 2700, Object.assign({ type: 'hilo_responde', to: to, help: contact.help, text: contact.reply.split('{yo}').join(meName) }, base));
    });
    t += 3400 + plot.contacts.length * 150;
    later(t, Object.assign({ type: 'paso', tool: 'propuesta.redactar', by: meId, state: 'inicio', willing: plot.helpers.length }, base));
    later(t + 2400, Object.assign({ type: 'paso', tool: 'propuesta.redactar', by: meId, state: 'fin' }, base));
    var proposal = plot.proposal.split('{yo}').join(meName);
    later(t + 2500, Object.assign({ type: 'propuesta_nace', helpers: plot.helpers.map(idOf), text: proposal, scripted: function () { askParent({ id: 'acepta', text: 'Tu agente encontró ayuda.\n\n' + proposal, options: ['Aceptar', 'Ahora no'] }); } }, base));
    closing(t + 2600, base, id, 'propuesta');
  }
  var PLOTS = [
    null,
    {
      topic: 'Que alguien tome la reunión de ventas de mañana a las 11', agendas: true, helpers: ['AMG'],
      contacts: [{ name: 'AMG', help: 'si', ask: '{yo} necesita a alguien que tome mañana a las 11 la reunión de ventas con un cliente nuevo. Te escribo a ti porque llevas las ventas y las demostraciones a clientes: ¿puedes tomarla?', reply: 'Mañana a las 11 lo tiene libre: solo está ocupado de 9 a 10 y de 15 a 16. Ventas con clientes nuevos es lo suyo, así que puede tomarla.' }],
      proposal: 'AMG toma mañana a las 11 la reunión de ventas con el cliente nuevo. AMG todavía tiene que aceptarlo.'
    },
    {
      topic: 'Migración de un cliente nuevo: traspaso de los planes activos', agendas: false, helpers: ['natochi'],
      contacts: [
        { name: 'natochi', help: 'si', ask: '{yo} está con un bloqueo en la migración de un cliente nuevo, en el traspaso de los planes activos. Te escribo a ti porque llevas las migraciones: ¿puedes ayudar a destrabarlo?', reply: 'Sí, natochi lleva las migraciones y el traspaso de planes, y hoy tiene disponibilidad. Que {yo} le cuente dónde se trabó.' },
        { name: 'Robert', help: 'parcial', ask: '{yo} está con un bloqueo en el traspaso de los planes activos de un cliente que se migra. Te escribo porque conoces las migraciones de base de datos: ¿puedes ayudar con la parte de los datos?', reply: 'Robert puede orientar con la parte de los datos, pero esta semana no puede hacerse cargo del traspaso.' }
      ],
      proposal: 'natochi ayuda a {yo} con el traspaso de los planes activos. {yo} le cuenta dónde se trabó y lo ven hoy.'
    }
  ];
  if (SCRIPTED) addEventListener('message', function (event) {
    var data = event.data;
    if (event.origin !== location.origin || !data || data.montu !== 'guion' || meId === null) return;
    if (data.dice) {
      var plot = PLOTS[sceneAt % PLOTS.length];
      sceneAt += 1;
      if (!plot) { pending = null; playQuestion(data.dice); return; }
      pending = plot;
      setTimeout(function () { askParent({ id: 'permiso', text: '¿Le pido ayuda a tu equipo con «' + plot.topic + '»? Si dices que sí, los agentes de tu equipo van a saber que tienes ese pedido.', options: ['Permitir', 'No contar'] }); }, 1400);
    } else if (data.elige === 'permiso' && data.opcion === '0' && pending) { var chosen = pending; pending = null; playNeed(chosen); }
  });

  var pace = function () { return running || Date.now() < urgentUntil ? RUNNING_MS : IDLE_MS; };

  function poll() {
    if (flying) return;
    if (loaded && W === 0) { timer = setTimeout(poll, pace()); return; }
    flying = true;
    fetch(source + '?since=' + since, { credentials: 'same-origin' })
      .then(function (response) { return response.ok ? response.json() : null; })
      .then(function (data) { if (data) apply(data); })
      .catch(function () {})
      .then(function () { flying = false; clearTimeout(timer); timer = setTimeout(poll, pace()); });
  }

  // La página que incrusta el globo avisa cuando alguien inicia una ronda, para no esperar el próximo ciclo.
  addEventListener('message', function (event) {
    if (event.origin !== location.origin || !event.data || event.data.montu !== 'ronda') return;
    urgentUntil = Date.now() + URGENT_MS;
    clearTimeout(timer); poll();
  });

  poll();
})();
