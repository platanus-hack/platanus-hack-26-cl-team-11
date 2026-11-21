/*
 * Montu · entrada. La pantalla de carga: una constelación de puntos que se junta en una esfera que gira,
 * y delante las caras del equipo, una al lado de la otra, mirándote.
 * Pedido de Mati del 21-nov-2026: «avatar stack of faces looking at you, with the constellation thing».
 *
 *   var entrada = RondaEntrada.mount(nodo, opciones)   arma la escena dentro de nodo
 *       opciones  names (las caras, por defecto el equipo), still (true: sin animación, para capturas)
 *   entrada.replay()     vuelve a empezar
 *   entrada.leave()      la salida: la esfera se abre hacia afuera y las caras se van, para mostrar la pantalla de atrás
 *   entrada.destroy()
 *   RondaEntrada.introMs()   cuánto dura la entrada hasta quedar armada
 *
 * Necesita design/luz/luz.js y design/faces/caras.js cargados antes, y las clases rd-entrada de design/ronda.css.
 * Con prefers-reduced-motion la esfera queda quieta y las caras aparecen sin rebote.
 */
(function () {
  'use strict';

  var TAU = Math.PI * 2;
  var TEAM = ['mati', 'ian', 'lian', 'andres', 'roberto'];
  var DOTS = 560;
  var GATHER_S = 1.25;
  var SPIN = 0.16;
  var TILT = 0.38;
  var FACE_START_MS = 380;
  var FACE_STEP_MS = 95;
  var INTRO_MS = 2000;
  var LEAVE_S = 0.75;
  var FACE_LEAVE_STEP_MS = 45;
  var GRADIENT_TOKENS = ['--rd-g1', '--rd-g2', '--rd-g3', '--rd-g4', '--rd-g5'];

  var reducedMotion = function () { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; };
  var clamp = function (x) { return x < 0 ? 0 : x > 1 ? 1 : x; };
  var easeOut = function (x) { x = clamp(x); return 1 - Math.pow(1 - x, 3); };
  var easeIn = function (x) { x = clamp(x); return x * x * x; };

  function seeded(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6d2b79f5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hexToRgb(hex) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    var n = parseInt(h, 16);
    return isNaN(n) ? [160, 150, 230] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function colorAt(stops, u) {
    var x = clamp(u) * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(x)), f = x - i;
    var a = stops[i], b = stops[i + 1];
    return [Math.round(a[0] + (b[0] - a[0]) * f), Math.round(a[1] + (b[1] - a[1]) * f), Math.round(a[2] + (b[2] - a[2]) * f)];
  }

  function buildDots(stops) {
    var random = seeded(21112026), dots = [], golden = Math.PI * (3 - Math.sqrt(5));
    for (var i = 0; i < DOTS; i += 1) {
      var y = 1 - (i / (DOTS - 1)) * 2, r = Math.sqrt(1 - y * y), theta = golden * i;
      var jitter = 0.035;
      var sphere = [Math.cos(theta) * r + (random() - 0.5) * jitter, y + (random() - 0.5) * jitter, Math.sin(theta) * r + (random() - 0.5) * jitter];
      var angle = random() * TAU, far = 1.7 + random() * 1.3;
      var rgb = colorAt(stops, (1 - y) / 2 * 0.85 + random() * 0.15);
      dots.push({
        sphere: sphere,
        from: [Math.cos(angle) * far, Math.sin(angle) * far * 0.8, (random() - 0.5) * far],
        delay: random() * 0.45,
        size: 0.75 + random() * 0.9,
        star: random() < 0.06,
        color: 'rgb(' + rgb.join(',') + ')',
      });
    }
    return dots;
  }

  function sky(canvas, dots) {
    var ctx = canvas.getContext('2d');
    var width = 0, height = 0, scale = 1;

    function resize() {
      var box = canvas.getBoundingClientRect();
      scale = Math.min(window.devicePixelRatio || 1, 2);
      width = box.width;
      height = box.height;
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
    }

    function draw(t, leaving) {
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.clearRect(0, 0, width, height);
      var away = leaving === undefined ? 0 : easeIn(leaving / LEAVE_S);
      var fade = 1 - clamp(leaving === undefined ? 0 : leaving / LEAVE_S);
      if (fade <= 0) return;
      var radius = Math.min(width, height) * 0.43 * (1 + away * 2.4), cx = width / 2, cy = height / 2;
      var turn = t * SPIN, cs = Math.cos(turn), sn = Math.sin(turn), ct = Math.cos(TILT), st = Math.sin(TILT);
      for (var i = 0; i < dots.length; i += 1) {
        var dot = dots[i];
        var sx = dot.sphere[0] * cs + dot.sphere[2] * sn;
        var sz = -dot.sphere[0] * sn + dot.sphere[2] * cs;
        var sy = dot.sphere[1] * ct - sz * st;
        var depth = dot.sphere[1] * st + sz * ct;
        var p = easeOut((t - dot.delay) / (GATHER_S - 0.45));
        var x = dot.from[0] + (sx - dot.from[0]) * p;
        var y = dot.from[1] + (sy - dot.from[1]) * p;
        var z = dot.from[2] + (depth - dot.from[2]) * p;
        var near = (z + 1) / 2;
        var alpha = clamp((t - dot.delay) / 0.35) * (0.14 + 0.72 * near * near) * fade;
        if (alpha <= 0.01) continue;
        var size = dot.size * (0.7 + near * 0.9) * (dot.star ? 1.9 : 1);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = dot.color;
        ctx.beginPath();
        ctx.arc(cx + x * radius, cy + y * radius, size, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    resize();
    return { draw: draw, resize: resize };
  }

  function lookingAtYou(name) {
    var caras = window.RondaCaras;
    var base = caras.recipeFor(name);
    return caras.compose(name, { rest: [0, 0.04], gaze: { period: base.gaze.period, phase: base.gaze.phase, range: 0.14 } });
  }

  function mount(host, options) {
    var settings = options || {};
    var still = settings.still === true || reducedMotion();
    var names = settings.names || TEAM;
    var style = getComputedStyle(document.documentElement);
    var stops = GRADIENT_TOKENS.map(function (name) { return hexToRgb(style.getPropertyValue(name).trim()); });

    host.classList.add('rd-entrada');
    host.innerHTML = '';
    var canvas = document.createElement('canvas');
    canvas.className = 'rd-entrada__cielo';
    canvas.setAttribute('aria-hidden', 'true');
    var row = document.createElement('div');
    row.className = 'rd-entrada__caras';
    host.appendChild(canvas);
    host.appendChild(row);

    var view = sky(canvas, buildDots(stops));
    var faces = [], timers = [], frame = 0, start = performance.now(), leftAt = null;

    function clearFaces() {
      timers.forEach(clearTimeout);
      timers = [];
      faces.forEach(function (face) { face.destroy(); });
      faces = [];
      row.innerHTML = '';
    }

    function placeFaces() {
      clearFaces();
      names.forEach(function (name, index) {
        var slot = document.createElement('span');
        slot.className = 'rd-entrada__cara';
        slot.style.zIndex = String(names.length - index);
        var face = document.createElement('span');
        slot.appendChild(face);
        row.appendChild(slot);
        var place = function () {
          slot.classList.add('is-in');
          faces.push(window.RondaCaras.mount(face, name, { recipe: lookingAtYou(name), interactive: true, light: true, enter: !still }));
        };
        if (still) place();
        else timers.push(setTimeout(place, FACE_START_MS + index * FACE_STEP_MS));
      });
    }

    function tick(now) {
      var leaving = leftAt === null ? undefined : (now - leftAt) / 1000;
      view.draw((now - start) / 1000, leaving);
      if (leaving === undefined || leaving < LEAVE_S) frame = requestAnimationFrame(tick);
    }

    placeFaces();
    if (still) view.draw(60);
    else frame = requestAnimationFrame(tick);

    var observer = new ResizeObserver(function () {
      view.resize();
      if (still) view.draw(60);
    });
    observer.observe(canvas);

    return {
      replay: function () {
        if (still) return;
        cancelAnimationFrame(frame);
        leftAt = null;
        start = performance.now();
        placeFaces();
        frame = requestAnimationFrame(tick);
      },
      leave: function () {
        if (leftAt !== null) return;
        var slots = row.children, last = slots.length - 1;
        for (var i = 0; i <= last; i += 1) {
          slots[i].style.transitionDelay = Math.abs(i - last / 2) * FACE_LEAVE_STEP_MS + 'ms';
          slots[i].classList.add('is-out');
        }
        if (still) { canvas.style.opacity = '0'; return; }
        leftAt = performance.now();
      },
      destroy: function () {
        cancelAnimationFrame(frame);
        observer.disconnect();
        clearFaces();
      },
    };
  }

  window.RondaEntrada = { mount: mount, introMs: function () { return reducedMotion() ? 700 : INTRO_MS; }, leaveMs: function () { return reducedMotion() ? 300 : LEAVE_S * 1000; } };
})();
