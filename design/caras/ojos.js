/*
 * Ronda · caras «Ojos». La persona es una gota de luz y solo tiene ojos.
 * Todo el carácter sale de la forma de los ojos, los anteojos, una ceja y cómo miran y parpadean.
 *
 *   RondaOjos.svg(seed, { size, recipe, t, rest, sheen })  el dibujo (SVG en texto) para ponerlo sobre la luz
 *   RondaOjos.animate(raiz, t)                             mueve todos los dibujos de la raíz; sin t corre solo
 *   RondaOjos.recipeFor(seed)                              receta determinista a partir de un texto
 *   RondaOjos.TEAM, RondaOjos.TEAM_LIGHT                   recetas del equipo y sus tonos de luz
 *
 * Lo que dibuja va en unidades de 100 x 100 y usa currentColor para la tinta: quien lo monta pone el color.
 * Con t el dibujo queda en ese instante; sin t y con rest queda en reposo (ojos abiertos, mirada al frente).
 */
(function (root) {
  'use strict';

  var uid = 0;

  function hashText(text) {
    var state = 0x811c9dc5;
    for (var i = 0; i < text.length; i += 1) { state ^= text.charCodeAt(i); state = Math.imul(state, 0x01000193); }
    return state >>> 0 || 0x9e3779b9;
  }
  function randomFrom(seed) {
    var state = hashText(seed);
    return function () { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 0x100000000; };
  }
  function mix(seedInt, index, salt) {
    var x = Math.imul(seedInt ^ Math.imul(index + 1, 0x9e3779b1) ^ Math.imul(salt + 7, 0x85ebca6b), 0xc2b2ae35);
    x ^= x >>> 15; x = Math.imul(x, 0x2c1b3c6d); x ^= x >>> 12;
    return (x >>> 0) / 0x100000000;
  }
  function pickWeighted(random, options) {
    var total = options.reduce(function (sum, option) { return sum + option[1]; }, 0);
    var roll = random() * total;
    for (var i = 0; i < options.length; i += 1) { roll -= options[i][1]; if (roll < 0) return options[i][0]; }
    return options[options.length - 1][0];
  }
  function smooth(x) { x = x < 0 ? 0 : x > 1 ? 1 : x; return x * x * (3 - 2 * x); }
  function round(value) { return Math.round(value * 100) / 100; }

  /*
   * Formas de ojo, dibujadas para el ojo izquierdo alrededor de (0, 0); la comisura externa mira a -x.
   * hw y hh son la mitad del ancho y del alto; luz es el brillo [x, y, rx, ry].
   */
  var SHAPES = {
    capsula: { hw: 4.5, hh: 10.4, d: 'M-4.5 -5.9A4.5 4.5 0 0 1 4.5 -5.9V5.9A4.5 4.5 0 0 1 -4.5 5.9Z', luz: [-1.4, -6.2, 1.25, 1.8] },
    ovalo: { hw: 5.5, hh: 8.2, d: 'M-5.5 0A5.5 8.2 0 1 1 5.5 0A5.5 8.2 0 1 1 -5.5 0Z', luz: [-1.8, -3.9, 1.5, 2] },
    cuenta: { hw: 6.3, hh: 6.3, d: 'M-6.3 0A6.3 6.3 0 1 1 6.3 0A6.3 6.3 0 1 1 -6.3 0Z', luz: [-2.1, -2.5, 1.7, 2] },
    punto: { hw: 4.4, hh: 4.4, d: 'M-4.4 0A4.4 4.4 0 1 1 4.4 0A4.4 4.4 0 1 1 -4.4 0Z', luz: [-1.2, -1.4, 1, 1.2] },
    almendra: { hw: 7.6, hh: 7.4, d: 'M-7.6 2.2C-7 -4.3 -2.4 -7.5 2.2 -6.9C6 -6.4 8.2 -2.4 7.2 1.6C6.2 5.6 2.6 7.6 -1.4 7.2C-5.2 6.8 -7.8 5.2 -7.6 2.2Z', luz: [-2.2, -3.4, 1.6, 1.9] },
    sonriente: { hw: 7.6, hh: 5.4, d: 'M-6.2 3.6Q0 -7.8 6.2 3.6', luz: null, stroke: 4.6, drop: -1.4 },
    sereno: { hw: 6.2, hh: 6.6, d: 'M-6.2 0.6Q-6.2 -5.1 -2.8 -5.3H2.8Q6.2 -5.1 6.2 0.6C6.2 5 3.5 7.4 0 7.4C-3.5 7.4 -6.2 5 -6.2 0.6Z', luz: [-2, -2.3, 1.5, 1.2], soft: true, drop: 1 },
    huevo: { hw: 6, hh: 9, d: 'M0 -9.4C3.6 -9.4 6 -4.6 6 0.6C6 5 3.4 8.4 0 8.4C-3.4 8.4 -6 5 -6 0.6C-6 -4.6 -3.6 -9.4 0 -9.4Z', luz: [-1.7, -4.2, 1.4, 1.9], drop: 0 }
  };
  var SIMPLE_AT_SMALL = { almendra: 'ovalo' };

  // Cada ceja: [trazo, altura extra del ojo izquierdo, altura extra del derecho, trazo del derecho]. La ceja alzada es la única asimétrica.
  var BROWS = {
    suave: { left: 'M-5.4 1Q0 -1.7 5.4 1', right: 'M-5.4 1Q0 -1.7 5.4 1', lift: [0, 0] },
    alzada: { left: 'M-5.4 0.4Q0 -1 5.4 1.4', right: 'M-5.4 1.6Q0 -2.8 5.4 1', lift: [-0.8, 2.6] }
  };

  var GLASSES = { redondo: { round: true }, suave: { round: false, corner: 5.8 } };

  /* Receta: todo lo que decide cómo se ve una persona. Es una función del nombre, no del azar. */
  function recipeFor(seed) {
    var random = randomFrom('ojos:' + seed);
    var recipe = {
      eye: pickWeighted(random, [['capsula', 22], ['ovalo', 20], ['cuenta', 13], ['almendra', 13], ['sonriente', 7], ['sereno', 7], ['huevo', 10], ['punto', 4]]),
      gap: 11.6 + random() * 5.2,
      k: 0.98 + random() * 0.34,
      cy: 49.6 + random() * 4.4,
      tilt: -Math.round(random() * 3.4),
      glasses: pickWeighted(random, [[null, 76], ['redondo', 14], ['suave', 10]]),
      brow: pickWeighted(random, [[null, 80], ['suave', 12], ['alzada', 8]]),
      rest: [(random() * 2 - 1) * 0.28, (random() * 2 - 1) * 0.18],
      blink: { period: 3.1 + random() * 3, phase: random() },
      gaze: { period: 5.2 + random() * 4.4, phase: random(), range: 0.55 + random() * 0.45 }
    };
    if (recipe.glasses) { if (recipe.eye === 'sonriente') recipe.eye = 'ovalo'; recipe.k *= 0.9; recipe.gap = Math.max(recipe.gap, 14.8); if (recipe.brow) recipe.brow = null; }
    if (recipe.eye === 'sereno' || recipe.eye === 'sonriente') recipe.brow = null;
    return recipe;
  }

  function team(overrides, seed) {
    var base = recipeFor(seed);
    for (var key in overrides) if (Object.prototype.hasOwnProperty.call(overrides, key)) base[key] = overrides[key];
    return base;
  }

  // Las cinco del equipo. Mismas cinco señas de siempre, dichas con los ojos.
  var TEAM = {
    mati: team({ eye: 'capsula', gap: 13, k: 1.18, cy: 51.5, tilt: 0, glasses: null, brow: 'alzada', rest: [0.1, 0], blink: { period: 4.1, phase: 0.18 }, gaze: { period: 7.2, phase: 0.1, range: 0.8 } }, 'mati'),
    ian: team({ eye: 'sonriente', gap: 14.5, k: 1.12, cy: 52, tilt: 0, glasses: null, brow: null, rest: [0, 0.05], blink: { period: 3.6, phase: 0.62 }, gaze: { period: 5.9, phase: 0.45, range: 0.9 } }, 'ian'),
    lian: team({ eye: 'ovalo', gap: 15.4, k: 1.06, cy: 52.2, tilt: 0, glasses: 'redondo', brow: null, rest: [0, 0], blink: { period: 4.8, phase: 0.33 }, gaze: { period: 8.4, phase: 0.7, range: 0.55 } }, 'lian'),
    roberto: team({ eye: 'sereno', gap: 14.6, k: 1.2, cy: 52.4, tilt: -2, glasses: null, brow: null, rest: [0, 0.1], blink: { period: 5.6, phase: 0.8 }, gaze: { period: 9.1, phase: 0.3, range: 0.6 } }, 'roberto'),
    andres: team({ eye: 'almendra', gap: 13.4, k: 1.16, cy: 51.4, tilt: -1.5, glasses: null, brow: 'suave', rest: [0.3, 0.12], blink: { period: 3.9, phase: 0.05 }, gaze: { period: 6.4, phase: 0.85, range: 0.7 } }, 'andres')
  };
  // Tonos de la rueda de design/luz/luz.js para la gota de cada integrante.
  var TEAM_LIGHT = { mati: [0, 9, 8, 1], ian: [5, 7, 4, 6], lian: [9, 8, 7, 10], roberto: [6, 5, 8, 7], andres: [2, 1, 3, 0] };

  /* ---------- Vida: dónde mira y cuánto cierra los ojos, como función pura del instante ---------- */

  function gazeTarget(seedInt, k, recipe) {
    var calm = mix(seedInt, k, 1) < 0.4;
    var spread = recipe.gaze.range;
    return [
      recipe.rest[0] + (calm ? 0 : (mix(seedInt, k, 2) * 2 - 1) * spread),
      recipe.rest[1] + (calm ? 0 : (mix(seedInt, k, 3) * 2 - 1) * spread * 0.62)
    ];
  }

  function closing(seconds, duration) {
    if (seconds < 0 || seconds > duration) return 0;
    var u = seconds / duration;
    return u < 0.38 ? smooth(u / 0.38) : 1 - smooth((u - 0.38) / 0.62);
  }

  function pose(recipe, seedInt, t, rest) {
    if (rest) return { gx: recipe.rest[0], gy: recipe.rest[1], shut: 0 };
    var gu = t / recipe.gaze.period + recipe.gaze.phase;
    var gk = Math.floor(gu);
    var blend = smooth((gu - gk) * recipe.gaze.period / 0.7);
    var from = gazeTarget(seedInt, gk - 1, recipe), to = gazeTarget(seedInt, gk, recipe);
    var bu = t / recipe.blink.period + recipe.blink.phase;
    var bk = Math.floor(bu);
    var seconds = (bu - bk) * recipe.blink.period;
    var onset = recipe.blink.period * (0.12 + 0.55 * mix(seedInt, bk, 5));
    var shut = closing(seconds - onset, 0.2);
    if (mix(seedInt, bk, 6) < 0.16) shut = Math.max(shut, closing(seconds - onset - 0.3, 0.2));
    return { gx: from[0] + (to[0] - from[0]) * blend, gy: from[1] + (to[1] - from[1]) * blend, shut: shut };
  }

  /* ---------- Dibujo ---------- */

  function levelFor(size) { return size >= 120 ? 'xl' : size >= 64 ? 'l' : size >= 32 ? 'm' : 's'; }

  function eyeMarkup(shape, level, ids, k) {
    var out = [];
    out.push('<ellipse class="oj-halo" cx="0" cy="' + round(shape.drop || 0) + '" rx="' + round(shape.hw * 2.5) + '" ry="' + round(shape.hh * 2.3) + '" fill="url(#' + ids.halo + ')"/>');
    if (shape.stroke) {
      out.push('<path d="' + shape.d + '" fill="none" stroke="url(#' + ids.arc + ')" stroke-width="' + shape.stroke + '" stroke-linecap="round"/>');
      return out.join('');
    }
    out.push('<path d="' + shape.d + '" fill="url(#' + ids.body + ')"' + (shape.soft ? ' stroke="url(#' + ids.body + ')" stroke-width="1.2" stroke-linejoin="round"' : '') + '/>');
    if (level === 'xl' || level === 'l') out.push('<path d="' + shape.d + '" fill="none" stroke="url(#' + ids.rim + ')" stroke-width=".8" stroke-linejoin="round"/>');
    if (level !== 's') {
      out.push('<ellipse cx="' + shape.luz[0] + '" cy="' + shape.luz[1] + '" rx="' + shape.luz[2] + '" ry="' + shape.luz[3] + '" fill="#fff" opacity=".96"/>');
    }
    return out.join('');
  }

  function glassesMarkup(recipe, shape, level, scale) {
    var kind = GLASSES[recipe.glasses];
    var stroke = round(Math.max(2.1, 1.4 / scale));
    var gw = round(shape.hw * recipe.k + 4.6), gh = round(Math.max(shape.hh * recipe.k * 0.94, shape.hw * recipe.k) + 3.6);
    if (kind.round) { gw = gh = Math.max(gw, gh); }
    var left = 50 - recipe.gap, right = 50 + recipe.gap, y = recipe.cy;
    var parts = [];
    function lens(cx) {
      var x = round(cx - gw), top = round(y - gh);
      var rx = kind.round ? gw : kind.corner;
      var out = '<rect x="' + x + '" y="' + top + '" width="' + round(gw * 2) + '" height="' + round(gh * 2) + '" rx="' + rx + '" fill="#fff" fill-opacity=".13"/>';
      out += '<rect x="' + x + '" y="' + top + '" width="' + round(gw * 2) + '" height="' + round(gh * 2) + '" rx="' + rx + '" fill="none" stroke="currentColor" stroke-opacity=".9" stroke-width="' + stroke + '"/>';
      if (level === 'xl' || level === 'l') out += '<path d="M' + round(cx - gw * 0.66) + ' ' + round(y - gh * 0.2) + 'Q' + round(cx - gw * 0.62) + ' ' + round(y - gh * 0.62) + ' ' + round(cx - gw * 0.2) + ' ' + round(y - gh * 0.7) + '" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="' + round(Math.max(1.2, 0.9 / scale)) + '" stroke-linecap="round"/>';
      return out;
    }
    parts.push(lens(left), lens(right));
    parts.push('<path d="M' + round(left + gw) + ' ' + round(y - gh * 0.22) + 'Q50 ' + round(y - gh * 0.62) + ' ' + round(right - gw) + ' ' + round(y - gh * 0.22) + '" fill="none" stroke="currentColor" stroke-opacity=".9" stroke-width="' + stroke + '" stroke-linecap="round"/>');
    parts.push('<path d="M' + round(left - gw) + ' ' + round(y - gh * 0.3) + 'L' + round(left - gw - 5) + ' ' + round(y - gh * 0.46) + 'M' + round(right + gw) + ' ' + round(y - gh * 0.3) + 'L' + round(right + gw + 5) + ' ' + round(y - gh * 0.46) + '" fill="none" stroke="currentColor" stroke-opacity=".9" stroke-width="' + stroke + '" stroke-linecap="round"/>');
    return '<g class="oj-glasses">' + parts.join('') + '</g>';
  }

  /*
   * Devuelve el dibujo de una persona. Si das t, queda en ese instante; con rest, en reposo.
   * Cada ojo y cada ceja lleva data-ojos para que animate() los mueva sin volver a dibujar.
   */
  function svg(seed, options) {
    var settings = options || {};
    var recipe = settings.recipe || TEAM[seed] || recipeFor(seed);
    var size = settings.size || 92;
    var level = settings.level || levelFor(size);
    var scale = size / 100;
    var shapeName = level === 's' && SIMPLE_AT_SMALL[recipe.eye] ? SIMPLE_AT_SMALL[recipe.eye] : recipe.eye;
    var shape = SHAPES[shapeName];
    var k = recipe.k * (level === 's' ? 1.3 : level === 'm' ? 1.1 : 1);
    var glasses = recipe.glasses && level !== 's';
    var number = ++uid;
    var ids = { halo: 'oj' + number + 'h', body: 'oj' + number + 'b', arc: 'oj' + number + 'a', rim: 'oj' + number + 'r', sheen: 'oj' + number + 's', lower: 'oj' + number + 'l' };
    var seedInt = hashText('ojos:' + seed);
    var state = pose(recipe, seedInt, settings.t || 0, settings.rest || settings.t == null);
    var haloPower = level === 's' ? 0.8 : level === 'm' ? 0.5 : level === 'l' ? 0.3 : 0.2;
    var out = [];

    out.push('<svg viewBox="0 0 100 100" aria-hidden="true" data-ojos="' + seed + '" data-size="' + size + '" fill="currentColor" width="100%" height="100%">');
    out.push('<defs>'
      + '<radialGradient id="' + ids.halo + '"><stop offset="0" stop-color="#fff" stop-opacity="' + haloPower + '"/><stop offset=".5" stop-color="#fff" stop-opacity="' + round(haloPower * 0.5) + '"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>'
      + '<linearGradient id="' + ids.body + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity=".95"/><stop offset=".6" stop-color="currentColor" stop-opacity=".9"/><stop offset="1" stop-color="currentColor" stop-opacity=".72"/></linearGradient>'
      + '<linearGradient id="' + ids.arc + '" gradientUnits="userSpaceOnUse" x1="0" y1="-6" x2="0" y2="4"><stop offset="0" stop-color="currentColor" stop-opacity=".97"/><stop offset="1" stop-color="currentColor" stop-opacity=".74"/></linearGradient>'
      + '<linearGradient id="' + ids.rim + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".62" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".3"/></linearGradient>'
      + '<radialGradient id="' + ids.sheen + '"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>'
      + '<radialGradient id="' + ids.lower + '"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>'
      + '</defs>');

    if (settings.sheen !== false && level !== 's') {
      out.push('<ellipse cx="35" cy="19" rx="26" ry="11" transform="rotate(-24 35 19)" fill="url(#' + ids.sheen + ')"/>');
      out.push('<ellipse cx="60" cy="95" rx="30" ry="9" fill="url(#' + ids.lower + ')"/>');
    }

    var eyes = [['L', 50 - recipe.gap, 1], ['R', 50 + recipe.gap, -1]];
    var drop = shape.drop || 0;
    var reach = glasses ? [2.1, 1.5] : [3.3, 2.2];
    out.push('<g data-ojos-eyes>');
    eyes.forEach(function (eye) {
      out.push('<g data-eye="' + eye[0] + '" data-x="' + round(eye[1]) + '" data-sign="' + eye[2] + '" data-k="' + round(k) + '" data-tilt="' + recipe.tilt + '" data-drop="' + drop + '" transform="' + eyeTransform(eye[1], recipe.cy, eye[2], k, recipe.tilt, drop, state, reach) + '">' + eyeMarkup(shape, level, ids, k) + '</g>');
    });
    out.push('</g>');

    if (glasses) out.push(glassesMarkup(recipe, shape, level, scale));

    if (recipe.brow && (level === 'xl' || level === 'l')) {
      var brow = BROWS[recipe.brow];
      var weight = round(Math.max(2.7, 1.6 / scale));
      eyes.forEach(function (eye, index) {
        var base = recipe.cy - shape.hh * k - 4.4 - brow.lift[index];
        out.push('<g data-brow="' + eye[0] + '" data-x="' + round(eye[1]) + '" data-sign="' + eye[2] + '" data-y="' + round(base) + '" transform="' + browTransform(eye[1], base, eye[2], state) + '"><path d="' + (index ? brow.right : brow.left) + '" fill="none" stroke="currentColor" stroke-opacity=".72" stroke-width="' + weight + '" stroke-linecap="round"/></g>');
      });
    }
    out.push('</svg>');
    return out.join('');
  }

  function eyeTransform(x, y, sign, k, tilt, drop, state, reach) {
    var sy = 1 - 0.94 * state.shut;
    var px = x + state.gx * reach[0], py = y + state.gy * reach[1] + (drop ? -drop * k : 0);
    return 'translate(' + round(px) + ' ' + round(py) + ') scale(' + round(sign * k) + ' ' + round(k * sy) + ') rotate(' + (tilt * 1) + ')';
  }
  function browTransform(x, y, sign, state) {
    return 'translate(' + round(x + state.gx * 1.4) + ' ' + round(y + state.gy * 1.1 + state.shut * 0.9) + ') scale(' + sign + ' 1)';
  }

  /* ---------- Movimiento en vivo ---------- */

  function apply(node, t, rest) {
    var cache = node.__ojos;
    if (!cache) {
      var seed = node.getAttribute('data-ojos');
      var recipe = TEAM[seed] || recipeFor(seed);
      var size = Number(node.getAttribute('data-size')) || 92;
      var glasses = recipe.glasses && levelFor(size) !== 's';
      cache = node.__ojos = {
        recipe: recipe,
        seedInt: hashText('ojos:' + seed),
        reach: glasses ? [2.1, 1.5] : [3.3, 2.2],
        eyes: Array.prototype.slice.call(node.querySelectorAll('[data-eye]')),
        brows: Array.prototype.slice.call(node.querySelectorAll('[data-brow]'))
      };
    }
    var state = pose(cache.recipe, cache.seedInt, t, rest);
    cache.eyes.forEach(function (eye) {
      eye.setAttribute('transform', eyeTransform(Number(eye.getAttribute('data-x')), cache.recipe.cy, Number(eye.getAttribute('data-sign')), Number(eye.getAttribute('data-k')), Number(eye.getAttribute('data-tilt')), Number(eye.getAttribute('data-drop')), state, cache.reach));
    });
    cache.brows.forEach(function (brow) {
      brow.setAttribute('transform', browTransform(Number(brow.getAttribute('data-x')), Number(brow.getAttribute('data-y')), Number(brow.getAttribute('data-sign')), state));
    });
  }

  function animate(host, t) {
    var nodes = Array.prototype.slice.call(host.querySelectorAll('svg[data-ojos]'));
    if (typeof t === 'number') { nodes.forEach(function (node) { apply(node, t, false); }); return null; }
    var still = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (still) { nodes.forEach(function (node) { apply(node, 0, true); }); return null; }
    var frame = 0, stopped = false;
    function loop(now) {
      if (stopped) return;
      frame += 1;
      if (frame % 2 === 0) nodes.forEach(function (node) { apply(node, now / 1000, false); });
      root.requestAnimationFrame(loop);
    }
    root.requestAnimationFrame(loop);
    return function () { stopped = true; };
  }

  root.RondaOjos = { svg: svg, rostro: svg, animate: animate, recipeFor: recipeFor, pose: pose, levelFor: levelFor, randomFrom: randomFrom, TEAM: TEAM, TEAM_LIGHT: TEAM_LIGHT, SHAPES: SHAPES };
})(window);
