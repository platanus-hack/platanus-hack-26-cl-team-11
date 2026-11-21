// Sala en vivo: dibuja en el globo a las personas reales de una sala y sus conversaciones.
// Lo carga sala.html dentro de globo.html?sala=CÓDIGO. No cambia el globo: reemplaza sus datos de demo.
// Propuesta pendiente de revisión de Mati (DESIGN.md, «Sigue abierto»).
(function () {
  var params = new URLSearchParams(location.search);
  var code = params.get('sala');
  var own = params.get('estado') || '';
  // ?estado=/api/… lee el estado de un equipo que no es sala (la pestaña Equipo). Solo rutas propias.
  var source = own.indexOf('/api/people/') === 0 ? own : code ? '/api/rooms/' + encodeURIComponent(code) + '/state' : null;
  if (!source || typeof g === 'undefined' || window.__salaViva) return;
  window.__salaViva = true;

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

  // Dentro de la app (pestaña Equipo) va solo la esfera, encuadrada al marco, igual que embed.js.
  if (own) {
    var CENTER_X = 590, CENTER_Y = 545, HALF_X = 470, HALF_Y = 380;
    style.textContent +=
      'html, body { height: 100%; overflow: hidden; background: transparent; }' +
      '.rd-page { min-height: 0; height: 100%; overflow: hidden; background: transparent; }' +
      '.globo { margin: 0; transform-origin: 0 0; }' +
      '.globo > .rd-aura, #thread-view { display: none !important; }' +
      '.globo { opacity: 0; transition: opacity .35s ease; } .globo.is-lista { opacity: 1; }';
    var stage = document.querySelector('.globo');
    var fit = function () {
      var width = window.innerWidth, height = window.innerHeight, scale = Math.min(width / (HALF_X * 2), height / (HALF_Y * 2));
      stage.style.transform = 'translate(' + (width / 2 - CENTER_X * scale).toFixed(2) + 'px, ' + (height / 2 - CENTER_Y * scale).toFixed(2) + 'px) scale(' + scale.toFixed(4) + ')';
    };
    window.addEventListener('resize', fit);
    fit();
  }

  var live = { people: [], threads: [] };
  var seen = '';

  // Cada persona real sale con su cara: la que eligió en Ajustes o la que le da su nombre. Se dibuja una vez y queda guardada.
  var PORTRAIT_PX = 192, PORTRAIT_SETTLE_MS = 600, MAX_PORTRAITS = 60, MAX_KEPT = 24, REVEAL_AFTER_MS = 1400;
  var KEPT_INDEX = 'montu-caras-v1', KEPT_PREFIX = 'montu-cara-v1:';
  var EYE_SIZES = { chica: 4.2, media: 5.2, grande: 6.4 }, EYE_SPACINGS = { juntos: 11.6, normal: 13.6, separados: 16 };
  var EYE_LIDS = { despiertos: 0, tranquilos: 0.22, sueno: 0.34 }, EYE_TILTS = { rectos: 0, arriba: 4, abajo: -4 };
  var portraits = {}, byName = {}, carasLoading = null;

  var loadCaras = function () {
    if (!carasLoading) carasLoading = new Promise(function (resolve, reject) {
      if (window.RondaCaras) { resolve(); return; }
      var script = document.createElement('script');
      script.src = '../faces/caras.js';
      script.onload = function () { resolve(); };
      script.onerror = reject;
      document.head.appendChild(script);
    });
    return carasLoading;
  };

  var imageFrom = function (source) {
    return new Promise(function (resolve, reject) {
      var image = new Image();
      image.onload = function () { resolve(image); };
      image.onerror = reject;
      image.src = source;
    });
  };

  var kept = function (key) {
    try { return window.localStorage.getItem(KEPT_PREFIX + key); } catch (failure) { return null; }
  };

  var keep = function (key, source) {
    try {
      var index = JSON.parse(window.localStorage.getItem(KEPT_INDEX) || '[]').filter(function (other) { return other !== key; });
      index.push(key);
      while (index.length > MAX_KEPT) window.localStorage.removeItem(KEPT_PREFIX + index.shift());
      window.localStorage.setItem(KEPT_PREFIX + key, source);
      window.localStorage.setItem(KEPT_INDEX, JSON.stringify(index));
    } catch (failure) { return; }
  };

  var lavaReady = function (lava) {
    if (!lava || lava.width <= 2) return true;
    try { return lava.getContext('2d').getImageData(lava.width >> 1, lava.height >> 1, 1, 1).data[3] > 0; } catch (failure) { return true; }
  };

  var settled = function (node) {
    var since = performance.now();
    return new Promise(function (resolve) {
      var check = function () {
        if (lavaReady(node.querySelector('.rd-cara__gota > canvas')) || performance.now() - since > PORTRAIT_SETTLE_MS) resolve();
        else requestAnimationFrame(check);
      };
      requestAnimationFrame(function () { requestAnimationFrame(check); });
    });
  };

  var drawPortrait = function (person) {
    var caras = window.RondaCaras, look = person.face;
    if (look) caras.customize(person.name, {
      recipe: { kind: look.kind, a: EYE_SIZES[look.size], gap: EYE_SPACINGS[look.spacing] || EYE_SPACINGS.normal, lid: EYE_LIDS[look.lid] || 0, tilt: EYE_TILTS[look.tilt] || 0, glasses: look.glasses, brow: look.brow, mark: look.mark, lashes: look.lashes },
      palette: caras.paletteFromTone(look.tone, look.mix || 'armonica')
    });
    var node = document.createElement('div');
    node.style.cssText = 'position:fixed;left:0;top:0;width:' + PORTRAIT_PX + 'px;height:' + PORTRAIT_PX + 'px;opacity:0.01;pointer-events:none;z-index:-1';
    document.body.appendChild(node);
    var face = caras.mount(node, person.name, { size: PORTRAIT_PX, rest: true, interactive: false, enter: false });
    return settled(node).then(function () {
      var tokens = getComputedStyle(document.documentElement);
      var canvas = document.createElement('canvas');
      canvas.width = canvas.height = PORTRAIT_PX;
      var ctx = canvas.getContext('2d');
      var lava = node.querySelector('.rd-cara__gota > canvas');
      if (lava && lava.width > 2) ctx.drawImage(lava, 0, 0, PORTRAIT_PX, PORTRAIT_PX);
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = getComputedStyle(node).getPropertyValue('--rd-cara-luz').trim() || tokens.getPropertyValue('--rd-g2').trim();
      ctx.fillRect(0, 0, PORTRAIT_PX, PORTRAIT_PX);
      ctx.globalCompositeOperation = 'source-over';
      var eyes = node.querySelector('.rd-cara__gota > svg').cloneNode(true);
      eyes.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      eyes.setAttribute('width', PORTRAIT_PX);
      eyes.setAttribute('height', PORTRAIT_PX);
      eyes.setAttribute('style', 'color:' + tokens.getPropertyValue('--rd-ink').trim());
      var shared = document.getElementById('rd-cara-defs');
      var defs = shared ? shared.innerHTML.replace(/var\((--[a-z0-9-]+)\)/g, function (match, name) { return tokens.getPropertyValue(name).trim(); }) : '';
      var markup = new XMLSerializer().serializeToString(eyes).replace(/^(<svg[^>]*>)/, '$1' + defs);
      return imageFrom('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(markup)).then(function (drawn) {
        ctx.drawImage(drawn, 0, 0, PORTRAIT_PX, PORTRAIT_PX);
        return canvas.toDataURL('image/webp', 0.92);
      });
    }).finally(function () { face.destroy(); node.remove(); });
  };

  var portraitOf = function (person) {
    var key = person.name + '|' + JSON.stringify(person.face || null);
    if (portraits[key]) return portraits[key];
    var saved = kept(key);
    if (saved) {
      portraits[key] = imageFrom(saved).catch(function () { return null; });
      return portraits[key];
    }
    var turn = (byName[person.name] || Promise.resolve()).then(loadCaras).then(function () { return drawPortrait(person); });
    byName[person.name] = turn.catch(function () { return null; });
    portraits[key] = turn.then(function (source) { keep(key, source); return imageFrom(source); }).catch(function () { return null; });
    return portraits[key];
  };

  var shown = false;
  var reveal = function () {
    if (shown) return;
    shown = true;
    var stage = document.querySelector('.globo');
    if (stage) stage.classList.add('is-lista');
  };

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
      state.people.map(function (person) { return [person.id, person.name, person.assistants.join(' '), person.face || null]; }),
      state.threads.map(function (thread) { return [thread.id, thread.help]; })
    ]);
    if (next === seen) return;
    seen = next;
    live = state;
    var waiting = [];
    state.people.slice(0, g.MAX).forEach(function (person, index) {
      g.people[index] = { name: person.name, status: statusOf(person), tile: tileOf(person.id), pid: person.id, image: null };
      if (person.synthetic || index >= MAX_PORTRAITS) {
        if (!g.atlas.src) { g.atlas.src = g.ATLAS; g.atlasBlur.src = g.ATLAS_BLUR; }
        return;
      }
      waiting.push(portraitOf(person).then(function (image) {
        if (image && g.people[index] && g.people[index].pid === person.id) g.people[index].image = image;
      }));
    });
    Promise.all(waiting).then(reveal);
    setTimeout(reveal, REVEAL_AFTER_MS);
    var count = Math.max(1, Math.min(g.MAX, state.people.length));
    if (count !== g.state.n) g.setN(count, false);
    else { g.buildGroups(count); g.setState({ auto: false, focus: null, groupCount: g.groups.length }); }
  };

  var announceReady = function () {
    if (typeof window.salaLista !== 'function') return;
    window.salaLista();
    window.salaLista = null;
  };

  var refresh = function () {
    fetch(source)
      .then(function (response) { return response.ok ? response.json() : null; })
      .then(function (state) { if (state) apply(state); })
      .catch(function () {})
      .then(announceReady);
  };

  g.setState({ auto: false });
  if (own) loadCaras().catch(function () {});
  else reveal();
  if (own && window.__estadoPrevio) window.__estadoPrevio.then(function (state) { if (state) apply(state); else refresh(); });
  else refresh();
  setInterval(refresh, REFRESH_MS);
})();
