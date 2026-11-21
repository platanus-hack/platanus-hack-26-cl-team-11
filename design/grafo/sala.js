// Sala en vivo: dibuja en el globo a las personas reales de una sala y sus conversaciones.
// Lo carga sala.html dentro de globo.html?sala=CÓDIGO. No cambia el globo: reemplaza sus datos de demo.
// Propuesta pendiente de revisión de Mati (DESIGN.md, «Sigue abierto»).
(function () {
  var code = new URLSearchParams(location.search).get('sala');
  if (!code || typeof g === 'undefined') return;

  var REFRESH_MS = 1500;
  var ATLAS_FACES = 64;
  var GROUP_STAGGER = 2.3;
  var ASSISTANT_NAME = {
    'claude-code': 'Claude Code', claude: 'Claude', codex: 'Codex', chatgpt: 'ChatGPT', grok: 'Grok',
    openclaw: 'OpenClaw', cursor: 'Cursor', gemini: 'Gemini', instinct: 'Instinct', otro: 'Asistente'
  };

  var style = document.createElement('style');
  style.textContent = '.globo aside, .globo .rd-hero, .globo .rd-bar { display: none !important; }';
  document.head.appendChild(style);

  var live = { people: [], threads: [] };
  var seen = '';

  var tileOf = function (id) {
    var hash = 0;
    for (var i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) % ATLAS_FACES;
    return hash;
  };

  var statusOf = function (person) {
    if (person.synthetic) return 'Persona simulada';
    if (!person.assistants.length) return 'Sin agente todavía';
    return person.assistants.map(function (kind) { return ASSISTANT_NAME[kind] || ASSISTANT_NAME.otro; }).join(', ');
  };

  g.buildGroups = function () {
    var position = {};
    live.people.forEach(function (person, index) { position[person.id] = index; });
    var byRequester = {}, order = [];
    live.threads.forEach(function (thread) {
      var from = position[thread.from], to = position[thread.to];
      if (from === undefined || to === undefined || from >= this.MAX || to >= this.MAX) return;
      if (!byRequester[from]) { byRequester[from] = { id: 'pide-' + from, members: [from], edges: [], topic: thread.topic, fixed: true }; order.push(from); }
      var group = byRequester[from];
      if (group.members.indexOf(to) < 0) group.members.push(to);
      group.edges.push([from, to, 1, thread.topic]);
    }, this);
    var groups = order.map(function (from, index) { byRequester[from].offset = index * GROUP_STAGGER; return byRequester[from]; });
    if (groups.length) { var latest = groups[groups.length - 1]; latest.id = 'mia'; latest.mine = true; }
    this.groups = groups;
  };

  var apply = function (state) {
    var next = JSON.stringify([
      state.people.map(function (person) { return [person.id, person.name, person.assistants.join(' ')]; }),
      state.threads.map(function (thread) { return [thread.id, thread.help]; })
    ]);
    if (next === seen) return;
    seen = next;
    live = state;
    state.people.slice(0, g.MAX).forEach(function (person, index) {
      g.people[index] = { name: person.name, status: statusOf(person), tile: tileOf(person.id) };
    });
    var count = Math.max(1, Math.min(g.MAX, state.people.length));
    if (count !== g.state.n) g.setN(count, false);
    else { g.buildGroups(count); g.setState({ auto: false, focus: null, groupCount: g.groups.length }); }
  };

  var refresh = function () {
    fetch('/api/rooms/' + encodeURIComponent(code) + '/state')
      .then(function (response) { return response.ok ? response.json() : null; })
      .then(function (state) { if (state) apply(state); })
      .catch(function () {});
  };

  g.setState({ auto: false });
  refresh();
  setInterval(refresh, REFRESH_MS);
})();
