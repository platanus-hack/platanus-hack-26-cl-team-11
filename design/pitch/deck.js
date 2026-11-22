(function () {
  'use strict';
  var query = new URLSearchParams(location.search);
  var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches || query.has('still');
  var byId = function (id) { return document.getElementById(id); };
  var format = function (n) { return n.toLocaleString('es-CL'); };
  var pairsOf = function (n) { return n * (n - 1) / 2; };
  var token = function (name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); };

  var HOOK = 7408;
  var SIZES = [5, 10, 25, 100, 300];
  var SMALL = SIZES[0];
  var GOLDEN_ANGLE = 2.39996323;
  var COUNT_MS = 600;
  var DRAW_FRAMES = 14;
  var RING_UP_TO = 10;

  var net = byId('net');
  var pen = net.getContext('2d');
  var drawing = 0;
  var people = 0;

  function lookFor(n) {
    if (n <= 10) return { dot: 11, line: 2.2, alpha: 0.5 };
    if (n <= 25) return { dot: 7, line: 1.4, alpha: 0.28 };
    if (n <= 100) return { dot: 3.6, line: 0.7, alpha: 0.1 };
    return { dot: 2.4, line: 0.5, alpha: 0.045 };
  }

  function drawNet(n, instant) {
    var run = ++drawing;
    var box = net.getBoundingClientRect();
    var ratio = Math.min(window.devicePixelRatio || 1, 2);
    people = n;
    if (!box.width || !box.height || !pen) return;
    net.width = box.width * ratio;
    net.height = box.height * ratio;
    pen.setTransform(ratio, 0, 0, ratio, 0, 0);
    var ring = n <= RING_UP_TO;
    var look = lookFor(n);
    var radius = Math.min(box.width, box.height) * 0.42;
    var points = [];
    for (var k = 0; k < n; k++) {
      var reach = ring ? radius * 0.82 : radius * Math.sqrt((k + 0.5) / n);
      var angle = ring ? -Math.PI / 2 + (k / n) * Math.PI * 2 : k * GOLDEN_ANGLE;
      points.push([box.width / 2 + reach * Math.cos(angle), box.height / 2 + reach * Math.sin(angle)]);
    }
    var ink = token('--rd-ink');
    var tint = token('--rd-g3');
    var total = pairsOf(n);
    var batch = Math.ceil(total / DRAW_FRAMES);
    var done = 0;
    var i = 0;
    var j = 1;
    var dots = function () {
      pen.globalAlpha = 1;
      pen.fillStyle = ink;
      points.forEach(function (point) {
        pen.beginPath();
        pen.arc(point[0], point[1], look.dot, 0, Math.PI * 2);
        pen.fill();
      });
    };
    var frame = function () {
      if (run !== drawing) return;
      var upto = Math.min(total, done + batch);
      pen.globalAlpha = look.alpha;
      pen.strokeStyle = n <= 25 ? ink : tint;
      pen.lineWidth = look.line;
      pen.beginPath();
      while (done < upto) {
        pen.moveTo(points[i][0], points[i][1]);
        pen.lineTo(points[j][0], points[j][1]);
        done += 1;
        j += 1;
        if (j === n) { i += 1; j = i + 1; }
      }
      pen.stroke();
      if (done >= total) dots();
      else if (instant) frame();
      else requestAnimationFrame(frame);
    };
    dots();
    frame();
  }

  var counting = 0;
  function writeHook(text) {
    byId('hook-first').textContent = text.charAt(0);
    byId('hook-rest').textContent = text.slice(1);
  }
  function countTo(target, instant, node) {
    var run = ++counting;
    node = node || byId('count');
    var write = node.id === 'hook' ? writeHook : function (text) { node.textContent = text; };
    var from = Number(node.dataset.value || target);
    node.dataset.value = String(target);
    if (instant || from === target) { write(format(target)); return; }
    var start = performance.now();
    var frame = function (now) {
      if (run !== counting) return;
      var progress = Math.min(1, (now - start) / COUNT_MS);
      var eased = 1 - Math.pow(1 - progress, 4);
      write(format(Math.round(from + (target - from) * eased)));
      if (progress < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  function showScale(step, instant) {
    var n = SIZES[Math.min(SIZES.length, step) - 1];
    byId('people').textContent = format(n) + ' personas';
    countTo(pairsOf(n), instant);
    if (n === SMALL) { drawing += 1; people = 0; }
    else if (n !== people) drawNet(n, instant);
  }

  var Caras = window.RondaCaras;
  var faces = Array.from(document.querySelectorAll('.pb-face')).map(function (node) {
    var size = Number(node.dataset.size);
    node.style.setProperty('--size', size + 'px');
    return { slide: node.closest('.pb-slide'), before: node.dataset.state || 'reposo', after: node.dataset.after || node.dataset.state || 'reposo', face: Caras.mount(node, node.dataset.face, { size: size, state: node.dataset.state || 'reposo' }) };
  });

  var ringFaces = Array.from(document.querySelectorAll('.pb-ring__face'));
  var ringSpots = ringFaces.map(function (node, at) {
    var angle = -Math.PI / 2 + (at / ringFaces.length) * Math.PI * 2;
    var spot = [50 + 34 * Math.cos(angle), 50 + 34 * Math.sin(angle)];
    node.style.setProperty('--x', spot[0] + '%');
    node.style.setProperty('--y', spot[1] + '%');
    return spot;
  });
  byId('ring-lines').innerHTML = ringSpots.map(function (from, at) {
    return ringSpots.slice(at + 1).map(function (to) { return '<line x1="' + from[0] + '" y1="' + from[1] + '" x2="' + to[0] + '" y2="' + to[1] + '"/>'; }).join('');
  }).join('');

  var KINDS = [['linear', 'Tarea', '--rd-g2'], ['github', 'Código', '--rd-g1'], ['gmail', 'Correo', '--rd-g4']];
  var PILE_ROWS = 6;
  var BRICK_MS = 110;
  var pile = byId('pile');
  var bricks = [];
  for (var row = 0; row < PILE_ROWS; row++) {
    var line = document.createElement('div');
    line.className = 'pb-pile__row';
    for (var place = 0; place < PILE_ROWS - row; place++) {
      var kind = KINDS[(place + row * 2) % KINDS.length];
      var brick = document.createElement('span');
      brick.className = 'pb-brick';
      brick.style.setProperty('--tint', 'var(' + kind[2] + ')');
      brick.innerHTML = '<img src="../sources/apps/' + kind[0] + '.png" alt="">' + kind[1];
      line.append(brick);
      bricks.push(brick);
    }
    pile.append(line);
  }
  var piling = 0;
  function startPile() {
    var run = ++piling;
    bricks.forEach(function (brick) { brick.removeAttribute('data-in'); });
    if (still) { bricks.forEach(function (brick) { brick.setAttribute('data-in', ''); }); return; }
    bricks.forEach(function (brick, at) {
      setTimeout(function () {
        if (run !== piling) return;
        brick.setAttribute('data-in', '');
        if (at === bricks.length - 1) faces.forEach(function (entry) { if (entry.slide === flood) entry.face.set('ausente'); });
      }, 500 + at * BRICK_MS);
    });
  }

  var slides = Array.from(document.querySelectorAll('.pb-slide'));
  var flood = document.querySelector('.pb-flood');
  var intro = document.querySelector('.pb-intro');
  var scale = slides.indexOf(document.querySelector('.pb-scale'));
  var current = -1;
  var stepAt = 1;
  var stepsOf = function (index) { return Number(slides[index].dataset.steps || 1); };

  function go(index, step) {
    index = Math.max(0, Math.min(slides.length - 1, index));
    step = Math.max(1, Math.min(stepsOf(index), step || 1));
    var entering = index !== current;
    if (entering) {
      slides.forEach(function (slide, at) {
        slide.toggleAttribute('data-on', at === index);
        slide.setAttribute('aria-hidden', String(at !== index));
      });
      if (current === scale) { drawing += 1; people = 0; }
      current = index;
    }
    stepAt = step;
    slides[index].dataset.k = String(step);
    faces.forEach(function (entry) { if (entry.slide === slides[index]) entry.face.set(step >= 2 ? entry.after : entry.before); });
    if (slides[index] === intro && entering && step === 1) {
      byId('hook').dataset.value = '0';
      countTo(HOOK, still, byId('hook'));
    }
    if (slides[index] === flood && entering) startPile();
    if (index === scale) showScale(step, still || (entering && step === 1 ? false : still));
    history.replaceState(null, '', '?s=' + index + (step > 1 ? '&k=' + step : '') + (query.has('still') ? '&still' : ''));
  }

  var forward = function () { if (stepAt < stepsOf(current)) go(current, stepAt + 1); else go(current + 1, 1); };
  var back = function () { if (stepAt > 1) go(current, stepAt - 1); else if (current > 0) go(current - 1, stepsOf(current - 1)); };

  byId('deck').addEventListener('click', forward);
  document.addEventListener('keydown', function (event) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    var key = event.key;
    if (key === 'ArrowRight' || key === 'PageDown' || key === ' ' || key === 'Enter') { event.preventDefault(); forward(); }
    else if (key === 'ArrowLeft' || key === 'PageUp') { event.preventDefault(); back(); }
    else if (key === 'f' || key === 'F') { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(function () {}); }
    else if (key === 'Home') go(0, 1);
    else if (key === 'End') go(slides.length - 1, 1);
  });
  window.addEventListener('message', function (event) {
    var data = event.data;
    if (event.origin !== window.location.origin || !data || data.montu !== 'deck') return;
    if (data.key === 'ArrowRight' || data.key === 'PageDown') forward();
    else if (data.key === 'ArrowLeft' || data.key === 'PageUp') back();
  });
  window.addEventListener('resize', function () { if (current === scale && people > SMALL) drawNet(people, true); });

  fetch('qr.svg').then(function (response) { return response.text(); }).then(function (svg) { document.querySelector('.pb-qr').innerHTML = svg; }).catch(function () {});

  var presenter = null;
  try { presenter = JSON.parse(window.localStorage.getItem('ronda.persona') || 'null'); } catch (failure) { presenter = null; }
  byId('stage').src = presenter && typeof presenter.token === 'string' ? '/conectar/' + encodeURIComponent(presenter.token) + '?vivo&escenario#globo' : '/';

  go(Number(query.get('s')) || 0, Number(query.get('k')) || 1);
  if (still) Caras.still(8);
})();
