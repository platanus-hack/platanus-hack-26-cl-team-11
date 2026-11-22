(function () {
  'use strict';
  var query = new URLSearchParams(location.search);
  var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches || query.has('still');
  var byId = function (id) { return document.getElementById(id); };
  var format = function (n) { return n.toLocaleString('es-CL'); };
  var pairsOf = function (n) { return n * (n - 1) / 2; };
  var token = function (name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); };

  var HOOK = 7408;
  var BANANAS = 3454;
  var BANK_DRIFT = 0.04;
  var SIZES = [5, 10, 25, 100, 300];
  var SMALL = SIZES[0];
  var GOLDEN_ANGLE = 2.39996323;
  var COUNT_MS = 600;
  var DRAW_FRAMES = 6;
  var MAX_LINES = 7000;
  var RING_UP_TO = 10;

  var net = byId('net');
  var pen = net.getContext('2d');
  var drawing = 0;
  var people = 0;

  function lookFor(n) {
    if (n <= 10) return { dot: 11, line: 2.2, alpha: 0.5 };
    if (n <= 25) return { dot: 7, line: 1.4, alpha: 0.28 };
    if (n <= 100) return { dot: 3.6, line: 0.7, alpha: 0.1 };
    return { dot: 2.4, line: 0.6, alpha: 0.11 };
  }

  function drawNet(n, instant) {
    var run = ++drawing;
    var box = net.getBoundingClientRect();
    var ratio = n > RING_UP_TO ? 1 : Math.min(window.devicePixelRatio || 1, 2);
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
    var skip = Math.max(1, Math.ceil(total / MAX_LINES));
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
        if (done % skip === 0) {
          pen.moveTo(points[i][0], points[i][1]);
          pen.lineTo(points[j][0], points[j][1]);
        }
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

  var banking = 0;
  var bankOn = false;
  function stopBank() {
    banking += 1;
    byId('bank-num').textContent = format(BANANAS);
    byId('bank-move').textContent = '';
  }
  function startBank() {
    var run = ++banking;
    var shown = BANANAS;
    var num = byId('bank-num');
    var move = byId('bank-move');
    var glide = function (to, ms, done) {
      var from = shown;
      var start = performance.now();
      var frame = function (now) {
        if (run !== banking) return;
        var progress = Math.min(1, (now - start) / ms);
        shown = Math.round(from + (to - from) * (1 - Math.pow(1 - progress, 3)));
        num.textContent = format(shown);
        if (progress < 1) requestAnimationFrame(frame);
        else done();
      };
      requestAnimationFrame(frame);
    };
    var drift = function () {
      if (run !== banking) return;
      var pull = (BANANAS - shown) / BANANAS;
      var change = (Math.random() - 0.5 + pull) * BANK_DRIFT;
      var to = Math.max(1, Math.round(shown * (1 + change)));
      move.textContent = (to >= shown ? '▲ ' : '▼ ') + format(Math.abs(to - shown));
      glide(to, 700 + Math.random() * 500, function () { setTimeout(drift, 900 + Math.random() * 900); });
    };
    setTimeout(drift, 700);
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
    return { node: node, size: size, slide: node.closest('.pb-slide'), ring: node.classList.contains('pb-ring__face'), before: node.dataset.state || 'reposo', after: node.dataset.after || node.dataset.state || 'reposo', face: null };
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

  var KINDS = [['linear', 'Tarea', '--rd-g2'], ['github', 'Código', '--rd-g1'], ['granola', 'Reunión', '--rd-g3'], ['gmail', 'Correo', '--rd-g4'], ['health', 'Sueño', '--rd-g5'], ['whoop', 'Rendimiento', '--rd-g2']];
  var PILE_ROWS = 6;
  var BRICK_MS = 110;
  var pile = byId('pile');
  var bricks = [];
  for (var row = 0; row < PILE_ROWS; row++) {
    var line = document.createElement('div');
    line.className = 'pb-pile__row';
    for (var place = 0; place < PILE_ROWS - row; place++) {
      var kind = KINDS[(place + row * 5) % KINDS.length];
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
        if (at === bricks.length - 1) faces.forEach(function (entry) { if (entry.slide === flood && entry.face) entry.face.set('ausente'); });
      }, 500 + at * BRICK_MS);
    });
  }

  var QR_QUIET = 2;
  var QR_AGENT_MS = 1700;
  var QR_STAGGER_MS = 150;
  var QR_POP_MS = 170;
  var QR_JITTER_MS = 90;
  var QR_REST_GAP = 14;
  var qrCard = byId('qr');
  var qrBox = qrCard.querySelector('.pb-qr__box');
  var qrDraft = byId('qr-draft');
  var qrPen = qrDraft.getContext('2d');
  var qrAgents = Array.from(qrCard.querySelectorAll('.pb-qr__agent'));
  var qrRun = 0;

  function qrCells(text) {
    var modules = window.MontuQr(text, { errorCorrectionLevel: 'M' }).modules;
    var cells = [];
    var path = '';
    for (var row = 0; row < modules.size; row++) {
      for (var column = 0; column < modules.size; column++) {
        if (!modules.get(row, column)) continue;
        var band = Math.min(qrAgents.length - 1, Math.floor((column / modules.size) * qrAgents.length));
        cells.push({ row: row, column: column, at: band * QR_STAGGER_MS + (row / modules.size) * QR_AGENT_MS + ((row * 31 + column * 17) % QR_JITTER_MS) });
        path += 'M' + (column + QR_QUIET) + ' ' + (row + QR_QUIET) + 'h1v1h-1z';
      }
    }
    var side = modules.size + QR_QUIET * 2;
    return { cells: cells, size: modules.size, side: side, svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + side + ' ' + side + '" shape-rendering="crispEdges"><path fill="currentColor" d="' + path + '"/></svg>' };
  }

  function qrFaces() { return faces.filter(function (entry) { return entry.node.classList.contains('pb-qr__agent') && entry.face; }); }

  function restQr(width) {
    qrAgents.forEach(function (node, at) {
      var size = Number(node.dataset.size);
      var x = width / 2 + (at - (qrAgents.length - 1) / 2) * (size + QR_REST_GAP);
      var y = width + parseFloat(getComputedStyle(qrCard).paddingBottom) + QR_REST_GAP + size / 2;
      node.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    });
  }

  function stopQr() {
    qrRun += 1;
    qrCard.removeAttribute('data-building');
    qrCard.removeAttribute('data-built');
  }

  function buildQr(text) {
    var run = ++qrRun;
    var code = qrCells(text);
    var width = qrBox.getBoundingClientRect().width;
    byId('qr-code').innerHTML = code.svg;
    qrCard.removeAttribute('data-built');
    var finish = function () {
      qrCard.removeAttribute('data-building');
      qrCard.setAttribute('data-built', '');
      restQr(width);
      qrFaces().forEach(function (entry) { entry.face.set('lista'); });
    };
    if (still || !width || !qrPen) { finish(); return; }
    var ratio = Math.min(window.devicePixelRatio || 1, 2);
    var cell = width / code.side;
    var band = (code.size * cell) / qrAgents.length;
    var total = (qrAgents.length - 1) * QR_STAGGER_MS + QR_AGENT_MS + QR_JITTER_MS + QR_POP_MS;
    qrDraft.width = qrDraft.height = Math.round(width * ratio);
    qrPen.setTransform(ratio, 0, 0, ratio, 0, 0);
    qrPen.fillStyle = token('--rd-ink');
    var place = function (elapsed) {
      qrAgents.forEach(function (node, at) {
        var progress = Math.max(0, Math.min(1, (elapsed - at * QR_STAGGER_MS) / QR_AGENT_MS));
        var x = QR_QUIET * cell + band * (at + 0.5) + Math.sin(progress * Math.PI * 6 + at) * band * 0.3;
        var y = (QR_QUIET + progress * code.size) * cell;
        node.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      });
    };
    place(0);
    qrCard.setAttribute('data-building', '');
    var start = performance.now();
    var frame = function (now) {
      if (run !== qrRun) return;
      var elapsed = now - start;
      qrPen.clearRect(0, 0, width, width);
      qrPen.beginPath();
      for (var k = 0; k < code.cells.length; k++) {
        var item = code.cells[k];
        var age = elapsed - item.at;
        if (age <= 0) continue;
        var grown = age >= QR_POP_MS ? 1 : 1 - Math.pow(1 - age / QR_POP_MS, 3);
        var inset = (cell * (1 - grown)) / 2;
        qrPen.rect((item.column + QR_QUIET) * cell + inset, (item.row + QR_QUIET) * cell + inset, cell * grown, cell * grown);
      }
      qrPen.fill();
      place(elapsed);
      if (elapsed < total) requestAnimationFrame(frame);
      else finish();
    };
    requestAnimationFrame(frame);
  }

  var resting = {};
  function rest(index) {
    clearTimeout(resting[index]);
    resting[index] = setTimeout(function () { slides[index].dataset.k = '1'; }, FACE_LEAVE_MS);
  }

  var FACE_LEAVE_MS = 600;
  function dropFace(entry, late) {
    if (!entry.face) return;
    clearTimeout(entry.leaving);
    var drop = function () {
      if (!entry.face) return;
      entry.face.destroy();
      entry.face = null;
      entry.node.replaceChildren();
    };
    if (late && !still) entry.leaving = setTimeout(drop, FACE_LEAVE_MS); else drop();
  }

  var slides = Array.from(document.querySelectorAll('.pb-slide'));
  slides.forEach(function (slide) { slide.dataset.k = '1'; });
  var flood = document.querySelector('.pb-flood');
  var closing = document.querySelector('.pb-try');
  var logo = document.querySelector('.pb-logo');
  var logoScene = null;
  var LOGO_FACES = ['mati', 'ian', 'lian', 'andres'];
  var platformUrl = '/';
  var presenter = null;
  try { presenter = JSON.parse(window.localStorage.getItem('ronda.persona') || 'null'); } catch (failure) { presenter = null; }
  if (presenter && typeof presenter.token === 'string') platformUrl = '/conectar/' + encodeURIComponent(presenter.token);
  else presenter = null;

  function findJoinUrl() {
    var origin = location.origin;
    var room = query.get('sala');
    if (room) return Promise.resolve(origin + '/unirse/' + encodeURIComponent(room));
    if (!presenter) return Promise.resolve(origin);
    var teamsPath = '/api/people/' + encodeURIComponent(presenter.token) + '/teams';
    var read = function (response) { return response.ok ? response.json() : Promise.reject(new Error(String(response.status))); };
    return fetch(teamsPath).then(read).then(function (found) {
      var open = found.teams.find(function (team) { return team.roomCode; });
      if (open) return origin + '/unirse/' + encodeURIComponent(open.roomCode);
      var own = found.teams.find(function (team) { return team.admin; });
      if (!own) return origin;
      if (own.invites.length > 0) return origin + own.invites[0].path;
      return fetch(teamsPath + '/' + encodeURIComponent(own.id) + '/invites', { method: 'POST' }).then(read).then(function (invite) { return origin + invite.path; });
    }).catch(function () { return origin; });
  }
  var joinUrl = null;
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
      if (current >= 0) rest(current);
      current = index;
    }
    stepAt = step;
    clearTimeout(resting[index]);
    slides[index].dataset.k = String(step);
    faces.forEach(function (entry) {
      var wanted = entry.slide === slides[index] && !(entry.ring && step > 1);
      if (!wanted) return dropFace(entry, entry.slide === slides[index]);
      clearTimeout(entry.leaving);
      if (!entry.face) entry.face = Caras.mount(entry.node, entry.node.dataset.face, { size: entry.size, state: entry.before });
      entry.face.set(step >= 2 ? entry.after : entry.before);
    });
    if (slides[index] === intro && entering && step === 1) {
      byId('hook').dataset.value = '0';
      countTo(HOOK, still, byId('hook'));
    }
    if (slides[index] === intro && step === 2 && !still) { if (!bankOn) { bankOn = true; startBank(); } } else if (bankOn) { bankOn = false; stopBank(); }
    if (slides[index] === flood && entering) startPile();
    if (entering && slides[index] === logo && !logoScene) logoScene = window.RondaEntrada.mount(byId('logo-escena'), { names: LOGO_FACES, still: still });
    if (entering && slides[index] !== logo && logoScene) { logoScene.destroy(); logoScene = null; byId('logo-escena').replaceChildren(); }
    if (entering && slides[index] !== closing) stopQr();
    if (entering && slides[index] === closing) {
      joinUrl = joinUrl || findJoinUrl();
      joinUrl.then(function (text) { if (slides[current] === closing) buildQr(text); });
    }
    if (index === scale) showScale(step, still || (entering && step === 1 ? false : still));
    history.replaceState(null, '', '?s=' + index + (step > 1 ? '&k=' + step : '') + (query.has('still') ? '&still' : ''));
  }

  var forward = function () { if (stepAt < stepsOf(current)) go(current, stepAt + 1); else if (current === slides.length - 2) window.location.href = platformUrl; else if (current < slides.length - 1) go(current + 1, 1); };
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
  window.addEventListener('resize', function () { if (current === scale && people > SMALL) drawNet(people, true); });

  window.addEventListener('resize', function () { if (slides[current] === closing && joinUrl) joinUrl.then(function (text) { if (qrCard.hasAttribute('data-built')) restQr(qrBox.getBoundingClientRect().width); else buildQr(text); }); });

  go(query.has('fin') ? slides.length - 1 : Number(query.get('s')) || 0, Number(query.get('k')) || 1);
  if (still) Caras.still(8);
})();
