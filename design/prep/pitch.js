/*
 * Montu · la presentación de ensayo (design/prep/, se abre en /prep). Copia de design/pitch/ para probar el guion nuevo:
 * la portada es un solo número y abajo de cada lámina va lo que se dice, paso a paso (N lo esconde).
 * Siete láminas, una idea cada una.
 *   ← → espacio y clic avanzan · N notas · F pantalla completa · V grabación de la demo · ?s=<n> abre una lámina (&k=2 su segundo paso)
 *   Las animaciones no se detienen solas: los controles de abajo pausan, adelantan y apuran la de la lámina abierta.
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var query = new URLSearchParams(location.search);
  var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches || query.has('still');
  var Caras = window.RondaCaras;
  var fmt = function (n) { return n.toLocaleString('es-CL'); };

  // Un texto cambia en su lugar: el anterior sale hacia arriba y el nuevo entra desde abajo (Roll de Stageshow).
  function roll(el, text, look) {
    var old = el.lastElementChild;
    if (old && old.textContent === text) return;
    var next = document.createElement('span');
    next.className = 'cx-roll__item' + (look ? ' ' + look : '');
    next.textContent = text;
    if (still || !old) { next.dataset.first = ''; el.replaceChildren(next); return; }
    el.querySelectorAll('[data-out]').forEach(function (gone) { gone.remove(); });
    old.dataset.out = '';
    old.addEventListener('animationend', function () { old.remove(); }, { once: true });
    el.append(next);
  }

  // Un número rueda carácter a carácter, de derecha a izquierda, solo donde cambió (Count de Stageshow).
  function counter(el, start) {
    var chars = function (n) { return fmt(n).split('').reverse(); };
    var column = function (c, fresh) {
      var cell = document.createElement('span');
      cell.className = 'cx-roll';
      cell.setAttribute('aria-hidden', 'true');
      cell.innerHTML = '<span class="cx-roll__item"' + (fresh && !still ? '' : ' data-first') + '>' + c + '</span>';
      return cell;
    };
    var shown = start;
    chars(start).forEach(function (c) { el.prepend(column(c)); });
    el.setAttribute('aria-label', fmt(start));
    return function (next) {
      if (next === shown) return;
      var before = chars(shown), after = chars(next), cols = Array.from(el.children).reverse();
      cols.slice(after.length).forEach(function (extra) { extra.remove(); });
      after.forEach(function (c, place) {
        if (!cols[place]) return el.prepend(column(c, true));
        if (before[place] !== c) setTimeout(function () { roll(cols[place], c); }, still ? 0 : place * 40);
      });
      shown = next;
      el.setAttribute('aria-label', fmt(next));
    };
  }

  // Un reloj que respeta pausa y velocidad: cada escena agenda sus pasos con él.
  var speed = 1, paused = false;
  function ticker(step, every) {
    var left = every, last = 0, raf = 0, on = false;
    var frame = function (t) {
      if (!on) return;
      if (last && !paused) left -= (t - last) * speed;
      last = t;
      if (left <= 0) left = step() || every;
      raf = requestAnimationFrame(frame);
    };
    return {
      start: function () { if (on || still) return; on = true; last = 0; left = every; raf = requestAnimationFrame(frame); },
      stop: function () { on = false; cancelAnimationFrame(raf); },
      now: function () { left = 0; },
    };
  }

  /* ---------- Portada: un solo número ---------- */
  var HOOK = 7408;
  var showHook = counter($('hook-n'), 0), hookSlide = document.querySelector('.pt-hook');
  var coverScene = {
    enter: function () { setTimeout(function () { showHook(HOOK); }, still ? 0 : 350); },
    step: function (k) {
      hookSlide.toggleAttribute('data-bet', k >= 2);
      hookSlide.toggleAttribute('data-claim', k >= 3);
      var seven = $('hook-n').firstElementChild;
      if (seven) roll(seven, k >= 2 ? '🍌' : '7');
    },
  };

  /* ---------- Contexto: todo lo de tu vida ya llega a tu agente ---------- */
  var SOURCES = [['whatsapp', 'WhatsApp'], ['gcal', 'Calendario'], ['gmail', 'Correo'], ['health', 'Salud'], ['github', 'Código'], ['granola', 'Reuniones']];
  var sourceTiles = SOURCES.map(function (src) {
    var item = document.createElement('div');
    item.className = 'pt-src';
    item.innerHTML = '<span class="cx-tile" style="--s: 96px"><img src="../sources/apps/' + src[0] + '.png" alt=""></span><span class="rd-person__name">' + src[1] + '</span>';
    $('context-apps').append(item);
    return item;
  });
  var contextFace = Caras.mount($('context-face'), 'Mati', { size: 132, interactive: true });
  var lit = 0;
  var contextTick = ticker(function () {
    if (lit === sourceTiles.length) { sourceTiles.forEach(function (tile) { tile.removeAttribute('data-sent'); }); lit = 0; contextFace.set('reposo'); return 900; }
    sourceTiles[lit].setAttribute('data-sent', '');
    contextFace.pulse();
    lit += 1;
    if (lit === sourceTiles.length) { contextFace.set('lista'); return 4200; }
    return 700;
  }, 700);
  var context = {
    enter: function () { if (still) { sourceTiles.forEach(function (tile) { tile.setAttribute('data-sent', ''); }); return; } contextTick.start(); },
    leave: function () { contextTick.stop(); },
    skip: function () { sourceTiles.forEach(function (tile) { tile.setAttribute('data-sent', ''); }); lit = sourceTiles.length; contextFace.set('lista'); },
  };

  /* ---------- 4. No escala: una red donde todos hablan con todos, de 5 personas a 300 ---------- */
  var pairs = function (n) { return n * (n - 1) / 2; };
  var token = function (name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); };
  var net = $('net'), pen = net.getContext('2d'), netSize = 5, netRun = 0;
  function drawNet(n, instant) {
    var run = ++netRun, box = net.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    netSize = n;
    if (!box.width || !pen) return;
    net.width = box.width * dpr;
    net.height = box.height * dpr;
    pen.setTransform(dpr, 0, 0, dpr, 0, 0);
    var few = n <= 12, radius = Math.min(box.width, box.height) * 0.31, points = [];
    for (var k = 0; k < n; k++) {
      var r = few ? radius * 0.86 : radius * Math.sqrt((k + 0.5) / n);
      var angle = few ? -Math.PI / 2 + (k / n) * Math.PI * 2 : k * 2.39996323;
      points.push([box.width / 2 + r * Math.cos(angle), box.height / 2 + r * Math.sin(angle)]);
    }
    var ink = token('--rd-ink'), tint = token('--rd-g2'), total = pairs(n), done = 0, i = 0, j = 1;
    var dots = function () {
      pen.globalAlpha = 1;
      pen.fillStyle = ink;
      points.forEach(function (point) { pen.beginPath(); pen.arc(point[0], point[1], few ? 11 : 2.4, 0, Math.PI * 2); pen.fill(); });
    };
    var frame = function () {
      if (run !== netRun) return;
      if (paused && !instant) { requestAnimationFrame(frame); return; }
      // Sin animación (cambio de tamaño, ?still) dibuja las mismas tandas de una vez: cada tanda es un trazo y la neblina de 300 sale de trazos que se suman.
      var upto = Math.min(total, done + Math.ceil(total / (few ? 24 : 70)) * (instant ? 1 : speed));
      pen.globalAlpha = few ? 0.6 : 0.045;
      pen.strokeStyle = few ? ink : tint;
      pen.lineWidth = few ? 2.5 : 0.5;
      pen.beginPath();
      while (done < upto) {
        pen.moveTo(points[i][0], points[i][1]);
        pen.lineTo(points[j][0], points[j][1]);
        done += 1; j += 1;
        if (j === n) { i += 1; j = i + 1; }
      }
      pen.stroke();
      if (done >= total) dots(); else if (instant) frame(); else requestAnimationFrame(frame);
    };
    if (few) dots();
    frame();
  }
  // Lo que generan los agentes cae como ladrillos y arma una pirámide encima de la red: tareas, código y correos.
  var KINDS = [['linear', 'Tarea', '--rd-g2'], ['github', 'Código', '--rd-g1'], ['gmail', 'Correo', '--rd-g4']];
  var flood = $('flood'), ROWS = 8, plan = [], bricks = [];
  var watchers = Array.from(flood.querySelectorAll('[data-watch]')).map(function (node) { return Caras.mount(node, node.dataset.watch, { size: 84, state: 'pensando' }); });
  function planPyramid() {
    var box = flood.getBoundingClientRect(), top = 122, bottom = box.height - Math.max(150, box.height * 0.3);
    var h = Math.min((bottom - top) / ROWS, 58), w = Math.min(h * 2.6, (box.width * 0.9) / ROWS);
    plan = [];
    for (var r = 0; r < ROWS; r++) {
      var count = ROWS - r, x0 = box.width / 2 - (count * w) / 2;
      for (var c = 0; c < count; c++) plan.push({ x: x0 + c * w, y: bottom - (r + 1) * h, w: w, h: h, kind: KINDS[(c + r * 2) % KINDS.length] });
    }
    flood.querySelectorAll('.pt-watch').forEach(function (node, side) {
      node.style.left = (side ? box.width / 2 + (ROWS * w) / 2 + 28 : box.width / 2 - (ROWS * w) / 2 - 28 - 84) + 'px';
      node.style.top = (bottom - 84) + 'px';
    });
  }
  function addBrick() {
    var spot = plan[bricks.length], brick = document.createElement('span');
    brick.className = 'pt-brick';
    brick.style.cssText = 'left:' + (spot.x + 2) + 'px;top:' + (spot.y + 2) + 'px;width:' + (spot.w - 4) + 'px;height:' + (spot.h - 4) + 'px;--tint:var(' + spot.kind[2] + ')';
    brick.innerHTML = '<img src="../sources/apps/' + spot.kind[0] + '.png" alt=""><span>' + spot.kind[1] + '</span>';
    flood.append(brick);
    bricks.push(brick);
    if (bricks.length % 5 === 0) watchers[(bricks.length / 5) % 2].pulse();
    if (bricks.length === plan.length) watchers.forEach(function (face) { face.set('ausente'); });
  }
  var clearChips = function () { bricks.forEach(function (brick) { brick.remove(); }); bricks = []; watchers.forEach(function (face) { face.set('pensando'); }); };
  var fillAll = function () { while (bricks.length < plan.length) addBrick(); };
  var floodTick = ticker(function () {
    if (bricks.length >= plan.length) return 60000;
    addBrick();
    return Math.max(70, 300 - bricks.length * 9);
  }, 350);
  var soon = ticker(function () { soon.stop(); if (scenes[current] === growth && stepAt === 2) go(current, 3); return 60000; }, 5000);
  var growth = {
    step: function (k) {
      var n = k >= 2 ? 300 : 5, agents = k >= 3;
      soon.stop();
      flood.toggleAttribute('data-agents', agents);
      roll($('net-title'), agents ? 'Y ahora trabajamos con agentes.' : 'Coordinar un equipo no escala.');
      roll($('net-caption'), agents ? 'El equipo produce información más rápido de lo que alcanza a leerla.' : fmt(n) + ' personas · ' + fmt(pairs(n)) + ' conversaciones');
      if (n !== netSize || !agents) drawNet(n, still);
      if (agents) { planPyramid(); if (still) fillAll(); floodTick.start(); }
      else { floodTick.stop(); clearChips(); if (k === 2) soon.start(); }
    },
    leave: function () { netRun += 1; soon.stop(); floodTick.stop(); clearChips(); netSize = 0; },
    skip: function () { if (stepAt < 3) go(current, stepAt + 1); else fillAll(); },
  };
  window.addEventListener('resize', function () { if (scenes[current] === growth) drawNet(netSize, true); });

  /* ---------- Tres pilares: con el clic final se apagan y queda la frase ---------- */
  var ARROW = '<svg viewBox="0 0 40 16"><path d="M2 8h32M27 2l8 6-8 6"/></svg>';
  var stillBrick = function (kind) { return '<span class="pt-brick pt-brick--still" style="--tint:var(' + kind[2] + ')"><img src="../sources/apps/' + kind[0] + '.png" alt=""><span>' + kind[1] + '</span></span>'; };
  var artFaces = [];
  var actor = function (name, state) { var node = document.createElement('span'); node.className = 'pt-face'; node.style.setProperty('--size', '76px'); artFaces.push(Caras.mount(node, name, { size: 76, state: state || 'reposo' })); return node; };
  document.querySelectorAll('.pt-art').forEach(function (art) {
    var kind = art.dataset.art;
    if (kind === 'same') ['Mati', 'Ian'].forEach(function (name) {
      var who = document.createElement('span');
      who.className = 'pt-art__who';
      who.append(actor(name, 'activa'));
      who.insertAdjacentHTML('beforeend', stillBrick(KINDS[1]));
      art.append(who);
    });
    if (kind === 'apart') [['Lian', -150], ['Roberto', -70], ['Andrés', 20]].forEach(function (pair) {
      var who = document.createElement('span');
      who.className = 'pt-art__who';
      who.append(actor(pair[0], 'activa'));
      who.insertAdjacentHTML('beforeend', '<span class="pt-arrow" style="--to:' + pair[1] + 'deg">' + ARROW + '</span>');
      art.append(who);
    });
    if (kind === 'quiet') {
      art.append(actor('Sofía', 'ausente'));
      art.insertAdjacentHTML('beforeend', '<span class="pt-unsaid rd-glass"><span class="pt-dots"><i></i><i></i><i></i></span></span>');
    }
  });
  var pillars = { step: function (k) { $('pillars').toggleAttribute('data-close', k >= 2); } };

  /* ---------- 6. El globo ---------- */
  var globe = $('globe'), globeTalks = 0, showGlobe = counter($('globe-talks'), 0);
  var tellGlobe = function (type, valor) { if (globe.contentWindow) globe.contentWindow.postMessage({ ronda: 'pagina', type: type, valor: valor }, '*'); };
  window.addEventListener('message', function (event) {
    var data = event.data;
    if (event.source !== globe.contentWindow || !data || data.ronda !== 'globo') return;
    if (data.type === 'listo') { tellGlobe('velocidad', speed); tellGlobe('pausa', paused); return; }
    if (data.type !== 'acuerdo') return;
    globeTalks += data.conversaciones;
    showGlobe(globeTalks);
    roll($('globe-topic'), data.tema);
  });
  var globeScene = {
    enter: function () {
      if (globe.src) return;
      var narrow = window.matchMedia('(max-width: 720px)').matches;
      globe.src = '../grafo/globo.html?embed&marco=' + (narrow ? 300 : 320) + '&ancho=' + (narrow ? 300 : 560) + (still ? '&still' : '');
    },
    pause: function (v) { tellGlobe('pausa', v); },
    speed: function (v) { tellGlobe('velocidad', v); },
    skip: function () { tellGlobe('adelantar'); },
  };

  /* ---------- 7. Tu agente es tuyo ---------- */
  var askFace = Caras.mount(document.querySelector('#ask [data-face]'), 'Lian', { size: 40, state: 'pensando' });
  $('allow').addEventListener('click', function () { askFace.set('lista'); roll($('ask-label'), 'Permitido: tu agente lo cuenta'); });
  $('deny').addEventListener('click', function () { askFace.set('reposo'); roll($('ask-label'), 'Tu agente no cuenta nada'); });
  var ask = { enter: function () { askFace.set('pensando'); roll($('ask-label'), 'Tu agente pregunta', 'rd-gradient-text'); } };

  /* ---------- La presentación ---------- */
  var slides = Array.from(document.querySelectorAll('.pt-slide'));
  var scenes = [coverScene, growth, pillars, globeScene, context, ask, null];
  var current = -1, stepAt = 1;
  slides.forEach(function (slide, i) {
    var tab = document.createElement('a');
    tab.href = '?s=' + (i + 1);
    tab.textContent = slide.dataset.tab;
    tab.addEventListener('click', function (event) { event.preventDefault(); go(i, 1); });
    $('tabs').append(tab);
  });
  var tabs = Array.from($('tabs').children);
  var scene = function () { return scenes[current] || {}; };

  function go(i, step) {
    i = Math.max(0, Math.min(slides.length - 1, i));
    var steps = Number(slides[i].dataset.steps || 1);
    step = Math.max(1, Math.min(steps, step || 1));
    if (i !== current) {
      if (scene().leave) scene().leave();
      slides.forEach(function (s, j) { s.toggleAttribute('data-on', j === i); s.setAttribute('aria-hidden', String(j !== i)); });
      tabs.forEach(function (t, j) { if (j === i) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current'); });
      current = i;
      if (scene().enter) scene().enter();
    }
    stepAt = step;
    if (scene().step) scene().step(step);
    $('where').textContent = (i + 1) + ' / ' + slides.length;
    showScript(slides[i], steps, step);
    history.replaceState(null, '', '?s=' + (i + 1) + (step > 1 ? '&k=' + step : '') + (still && query.has('still') ? '&still' : ''));
  }
  // El guion de la lámina, abajo: lo que se dice en el paso abierto va en tinta y el resto apagado; lo que va entre corchetes no se dice.
  function showScript(slide, steps, step) {
    var parts = (slide.dataset.script || '').split(' | ');
    $('script-time').textContent = slide.dataset.time || '';
    $('script-draft').hidden = !slide.hasAttribute('data-draft');
    $('script-text').replaceChildren.apply($('script-text'), parts.map(function (part, at) {
      var line = document.createElement('span');
      line.className = 'pt-script__line';
      if (parts.length < steps || at === step - 1) line.dataset.now = '';
      part.split(/(\[[^\]]*\])/).forEach(function (piece) {
        if (!piece) return;
        if (piece.charAt(0) !== '[') { line.append(piece); return; }
        var aside = document.createElement('span');
        aside.className = 'pt-script__aside';
        aside.textContent = piece;
        line.append(aside);
      });
      line.append(' ');
      return line;
    }));
  }
  var forward = function () {
    var steps = Number(slides[current].dataset.steps || 1);
    if (stepAt < steps) go(current, stepAt + 1); else go(current + 1, 1);
  };
  var back = function () {
    if (stepAt > 1) go(current, stepAt - 1);
    else { var prev = current - 1; go(prev, Number((slides[prev] || slides[0]).dataset.steps || 1)); }
  };

  $('next').addEventListener('click', forward);
  $('prev').addEventListener('click', back);
  $('deck').addEventListener('click', function (event) {
    if (event.target.closest('button, a, iframe, .cx-decision, .pt-silo, .pt-who')) return;
    forward();
  });

  var PAUSE = 'M6 4.2h1.6v9.6H6zM10.4 4.2H12v9.6h-1.6z', PLAY = 'M6.2 4.2l7.4 4.8-7.4 4.8z';
  $('play').addEventListener('click', function () {
    paused = !paused;
    globeScene.pause(paused);
    $('play').setAttribute('aria-pressed', String(paused));
    $('play').setAttribute('aria-label', paused ? 'Seguir' : 'Pausar');
    $('play-icon').setAttribute('d', paused ? PLAY : PAUSE);
  });
  $('skip').addEventListener('click', function () { if (scene().skip) scene().skip(); else forward(); });
  $('speed').addEventListener('click', function (event) {
    var key = event.target.closest('[data-speed]');
    if (!key) return;
    speed = Number(key.dataset.speed);
    globeScene.speed(speed);
    $('speed').querySelectorAll('[data-speed]').forEach(function (other) { other.setAttribute('aria-pressed', String(other === key)); });
  });
  var toggleNotes = function () {
    var hide = !$('script').hidden;
    $('script').hidden = hide;
    document.querySelector('.pt').toggleAttribute('data-clean', hide);
    $('notes-toggle').setAttribute('aria-pressed', String(!hide));
  };
  $('notes-toggle').addEventListener('click', toggleNotes);
  var toggleVideo = function (show) {
    var box = $('video'), video = box.querySelector('video');
    box.hidden = !show;
    if (show) video.play().catch(function () {}); else video.pause();
  };
  $('video').addEventListener('click', function (event) { if (event.target === $('video')) toggleVideo(false); });

  document.addEventListener('keydown', function (event) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    var key = event.key;
    if (key === 'ArrowRight' || key === 'PageDown' || (key === ' ' && !event.target.closest('button'))) { event.preventDefault(); forward(); }
    else if (key === 'ArrowLeft' || key === 'PageUp') { event.preventDefault(); back(); }
    else if (key === 'n' || key === 'N') toggleNotes();
    else if (key === 'f' || key === 'F') { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(function () {}); }
    else if (key === 'v' || key === 'V') toggleVideo($('video').hidden);
    else if (key === 'Escape') toggleVideo(false);
    else if (key === 'Home') go(0, 1);
    else if (key === 'End') go(slides.length - 1, 1);
  });

  go((Number(query.get('s')) || 1) - 1, Number(query.get('k')) || 1);
  if (still) Caras.still(8);

  /* ---------- Ícono de la pestaña: las tres órbitas del isotipo giran lento ---------- */
  (function favicon() {
    if (still) return;
    var link = $('favicon'), canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = canvas.height = 64;
    var css = getComputedStyle(document.documentElement);
    var stops = ['--rd-g5', '--rd-g4', '--rd-g3', '--rd-g1'].map(function (name) { return css.getPropertyValue(name).trim(); });
    if (stops.some(function (s) { return !s; })) return;
    var white = css.getPropertyValue('--rd-on-ink').trim() || 'white';
    var angle = 0;
    var draw = function () {
      if (document.hidden) return;
      var fill = ctx.createLinearGradient(0, 0, 64, 64);
      stops.forEach(function (color, i) { fill.addColorStop(i / (stops.length - 1), color); });
      ctx.clearRect(0, 0, 64, 64);
      ctx.fillStyle = fill;
      ctx.beginPath(); ctx.roundRect(0, 0, 64, 64, 18); ctx.fill();
      ctx.strokeStyle = white; ctx.lineWidth = 2.8;
      for (var k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.ellipse(32, 32, 21.6, 9.9, angle + k * Math.PI / 3, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = white;
      ctx.beginPath(); ctx.arc(32, 32, 4.2, 0, Math.PI * 2); ctx.fill();
      link.href = canvas.toDataURL('image/png');
      angle += 0.06;
    };
    draw();
    setInterval(draw, 120);
  })();
})();
