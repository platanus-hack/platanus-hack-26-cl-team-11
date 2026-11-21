/*
 * Ronda · Ojos, segunda vuelta. La persona es una gota de luz y solo tiene ojos, pero ahora los ojos
 * viven dentro del vidrio: sombra de contacto sobre la lava, borde de luz refractada, destello que
 * coincide con el de la gota, párpados de verdad y una mirada que sigue al puntero y a sus vecinos.
 *
 *   RondaOjos2.mount(nodo, semilla, { size, group })  dibuja los ojos dentro de nodo; devuelve la cara
 *   RondaOjos2.group()                                 un grupo de caras que se miran entre sí
 *   RondaOjos2.start(t)                                con t fija ese instante; sin t corre en vivo
 *   RondaOjos2.recipeFor(semilla), RondaOjos2.TEAM, RondaOjos2.TEAM_LIGHT
 *
 * Todo sale de una receta determinista por semilla y de una función pura del instante t.
 * Lo único con memoria es el suavizado del puntero y del hover, que solo existe en vivo.
 */
(function (root) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var clipCount = 0, groupCount = 0;
  var faces = [];

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
  function clamp(x, low, high) { return x < low ? low : x > high ? high : x; }
  function smooth(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }
  function round(value) { return Math.round(value * 100) / 100; }

  /* ---------- Recetas ---------- */

  function recipeFor(seed) {
    var random = randomFrom('ojos2:' + seed);
    var kind = pickWeighted(random, [['capsula', 22], ['ovalo', 22], ['cuenta', 14], ['almendra', 16], ['huevo', 12], ['arco', 6]]);
    var recipe = {
      kind: kind,
      a: 3.9 + random() * 2.6,
      tall: 1.05 + random() * 1.35,
      gap: 11 + random() * 6.2,
      cy: 47 + random() * 8,
      tilt: Math.round((random() * 2 - 0.55) * 5),
      lid: pickWeighted(random, [[0, 62], [0.22, 20], [0.34, 18]]),
      slant: (random() * 2 - 1) * 1.3,
      asym: random() < 0.12 ? 1 + (random() * 2 - 1) * 0.12 : 1,
      lashes: random() < 0.15,
      brow: pickWeighted(random, [[null, 78], ['plana', 9], ['arco', 8], ['alzada', 5]]),
      browSide: random() < 0.5 ? 1 : -1,
      glasses: pickWeighted(random, [[null, 74], ['redondo', 9], ['suave', 8], ['pantos', 5], ['ceja', 4]]),
      mark: pickWeighted(random, [[null, 84], ['lunar', 9], ['pecas', 7]]),
      rest: [(random() * 2 - 1) * 0.25, (random() * 2 - 1) * 0.16],
      blink: { period: 3.1 + random() * 3, phase: random() },
      gaze: { period: 5.2 + random() * 4.4, phase: random(), range: 0.55 + random() * 0.45 }
    };
    return tidy(recipe);
  }

  function tidy(recipe) {
    if (recipe.kind === 'cuenta') recipe.tall = 1;
    if (recipe.kind === 'capsula') recipe.tall = Math.max(recipe.tall, 1.6);
    if (recipe.kind === 'arco') { recipe.lid = 0; recipe.brow = null; recipe.lashes = false; recipe.tall = 0.9; }
    if (recipe.glasses) { recipe.gap = Math.max(recipe.gap, 14.8); recipe.brow = null; recipe.lashes = false; recipe.a = Math.min(recipe.a, 5.2); if (recipe.kind === 'arco') recipe.kind = 'ovalo'; if (recipe.glasses === 'ceja') recipe.lid = 0; }
    return recipe;
  }

  function team(overrides, seed) {
    var base = recipeFor(seed);
    for (var key in overrides) if (Object.prototype.hasOwnProperty.call(overrides, key)) base[key] = overrides[key];
    return tidy(base);
  }

  var NONE = { glasses: null, brow: null, lashes: false, mark: null, asym: 1, lid: 0, slant: 0 };
  function mine(extra, seed) { var all = {}; for (var key in NONE) all[key] = NONE[key]; for (var other in extra) all[other] = extra[other]; return team(all, seed); }

  // Las cinco señas de siempre dichas con los ojos: sin pelo, cada cual con su forma, su ceja y su manera de mirar.
  var TEAM = {
    mati: mine({ kind: 'capsula', a: 4.7, tall: 2.2, gap: 12.8, cy: 51.5, tilt: 0, brow: 'alzada', browSide: 1, rest: [0.12, 0], blink: { period: 4.1, phase: 0.18 }, gaze: { period: 7.2, phase: 0.1, range: 0.8 } }, 'mati'),
    ian: mine({ kind: 'arco', a: 7, tall: 0.9, gap: 14.6, cy: 52.4, tilt: 0, mark: 'pecas', rest: [0, 0.05], blink: { period: 3.6, phase: 0.62 }, gaze: { period: 5.9, phase: 0.45, range: 0.9 } }, 'ian'),
    lian: mine({ kind: 'ovalo', a: 4.8, tall: 1.25, gap: 15.6, cy: 52.2, tilt: 0, glasses: 'redondo', rest: [0, 0], blink: { period: 4.8, phase: 0.33 }, gaze: { period: 8.4, phase: 0.7, range: 0.55 } }, 'lian'),
    andres: mine({ kind: 'almendra', a: 6.7, tall: 1.05, gap: 13.4, cy: 51.4, tilt: 4, brow: 'alzada', browSide: -1, lashes: false, rest: [0.3, 0.1], blink: { period: 3.9, phase: 0.05 }, gaze: { period: 6.4, phase: 0.85, range: 0.7 } }, 'andres'),
    roberto: mine({ kind: 'cuenta', a: 5.6, tall: 1, gap: 14.8, cy: 52.6, tilt: -1, lid: 0.27, slant: -0.5, mark: 'lunar', rest: [0, 0.1], blink: { period: 5.6, phase: 0.8 }, gaze: { period: 9.1, phase: 0.3, range: 0.6 } }, 'roberto')
  };
  var TEAM_LIGHT = { mati: [0, 9, 8, 1], ian: [5, 7, 4, 6], lian: [9, 8, 7, 10], roberto: [6, 5, 8, 7], andres: [2, 1, 3, 0] };

  /* ---------- Forma del ojo, para el izquierdo: la comisura externa mira a -x ---------- */

  function halfHeight(recipe) { return round(recipe.a * recipe.tall); }

  function outline(kind, a, b) {
    switch (kind) {
      case 'capsula': { var r = Math.min(a, b); return 'M' + -a + ' ' + (-b + r) + 'A' + a + ' ' + r + ' 0 0 1 ' + a + ' ' + (-b + r) + 'V' + (b - r) + 'A' + a + ' ' + r + ' 0 0 1 ' + -a + ' ' + (b - r) + 'Z'; }
      case 'almendra': return 'M' + -a + ' ' + round(b * 0.2) + 'C' + round(-a * 0.7) + ' ' + round(-b * 1.05) + ' ' + round(a * 0.7) + ' ' + round(-b * 1.15) + ' ' + a + ' ' + round(-b * 0.15) + 'C' + round(a * 0.6) + ' ' + round(b * 0.95) + ' ' + round(-a * 0.5) + ' ' + round(b * 1.05) + ' ' + -a + ' ' + round(b * 0.2) + 'Z';
      case 'huevo': return 'M0 ' + -b + 'C' + round(a * 0.62) + ' ' + -b + ' ' + a + ' ' + round(-b * 0.25) + ' ' + a + ' ' + round(b * 0.1) + 'C' + a + ' ' + round(b * 0.7) + ' ' + round(a * 0.55) + ' ' + b + ' 0 ' + b + 'C' + round(-a * 0.55) + ' ' + b + ' ' + -a + ' ' + round(b * 0.7) + ' ' + -a + ' ' + round(b * 0.1) + 'C' + -a + ' ' + round(-b * 0.25) + ' ' + round(-a * 0.62) + ' ' + -b + ' 0 ' + -b + 'Z';
      default: return 'M' + -a + ' 0A' + a + ' ' + b + ' 0 1 1 ' + a + ' 0A' + a + ' ' + b + ' 0 1 1 ' + -a + ' 0Z';
    }
  }
  function arcPath(a, b) { return 'M' + -a + ' ' + round(b * 0.55) + 'Q0 ' + round(-b * 1.5) + ' ' + a + ' ' + round(b * 0.55); }

  /* Región visible del ojo: lo que deja libre el párpado de arriba y el de abajo. Es el mismo trazo cada cuadro, con otros números. */
  function lidPath(a, b, lid, squint, slant) {
    var w = round(a + 4);
    var top = -b - 3 + lid * (2 * b + 3.2);
    var low = b + 3 - squint * (b + 2.6);
    top = Math.min(top, low - 0.4);
    var bend = low - squint * b * 1.7;
    var sl = slant * Math.min(1, lid * 3);
    return 'M' + -w + ' ' + round(top + sl) + 'Q0 ' + round(top + 0.9 * lid) + ' ' + w + ' ' + round(top - sl) + 'L' + w + ' ' + round(low) + 'Q0 ' + round(bend) + ' ' + -w + ' ' + round(low) + 'Z';
  }

  var BROWS = {
    plana: 'M-5.6 1Q0 -0.8 5.6 1',
    arco: 'M-5.6 2Q-0.6 -2.4 5.6 0.8',
    alzada: 'M-5.6 1.8Q0 -2.4 5.6 0.2'
  };

  /* ---------- Vida: mirada y parpadeo como función pura del instante ---------- */

  function gazeTarget(seedInt, k, recipe) {
    var calm = mix(seedInt, k, 1) < 0.4;
    var spread = recipe.gaze.range;
    return [recipe.rest[0] + (calm ? 0 : (mix(seedInt, k, 2) * 2 - 1) * spread), recipe.rest[1] + (calm ? 0 : (mix(seedInt, k, 3) * 2 - 1) * spread * 0.6)];
  }
  function closing(seconds, duration) {
    if (seconds < 0 || seconds > duration) return 0;
    var u = seconds / duration;
    return u < 0.36 ? smooth(u / 0.36) : 1 - smooth((u - 0.36) / 0.64);
  }
  function pose(recipe, seedInt, t) {
    var gu = t / recipe.gaze.period + recipe.gaze.phase;
    var gk = Math.floor(gu);
    var blend = smooth((gu - gk) * recipe.gaze.period / 0.7);
    var from = gazeTarget(seedInt, gk - 1, recipe), to = gazeTarget(seedInt, gk, recipe);
    var bu = t / recipe.blink.period + recipe.blink.phase;
    var bk = Math.floor(bu);
    var seconds = (bu - bk) * recipe.blink.period;
    var onset = recipe.blink.period * (0.12 + 0.55 * mix(seedInt, bk, 5));
    var shut = closing(seconds - onset, 0.22);
    if (mix(seedInt, bk, 6) < 0.16) shut = Math.max(shut, closing(seconds - onset - 0.32, 0.22));
    return { gx: from[0] + (to[0] - from[0]) * blend, gy: from[1] + (to[1] - from[1]) * blend, shut: shut };
  }

  /* Cada grupo reparte un cruce de miradas entre dos vecinas cada tanto; sale solo del instante y del orden. */
  function glance(face, t) {
    var group = face.group;
    if (!group || group.faces.length < 2) return null;
    var period = 6.8, slot = Math.floor(t / period), seconds = t - slot * period;
    var pair = Math.floor(mix(group.seed, slot, 9) * (group.faces.length - 1));
    if (face.index !== pair && face.index !== pair + 1) return null;
    var start = 1.4 + mix(group.seed, slot, 10) * 2.4, length = 1.3 + mix(group.seed, slot, 11) * 0.9;
    var amount = smooth((seconds - start) / 0.3) * (1 - smooth((seconds - start - length) / 0.4));
    if (amount <= 0) return null;
    var other = group.faces[face.index === pair ? pair + 1 : pair];
    var dx = other.cx - face.cx, dy = other.cy - face.cy, dist = Math.sqrt(dx * dx + dy * dy) || 1;
    return { amount: amount, gx: clamp(dx / dist, -1, 1) * 0.95, gy: clamp(dy / dist, -1, 1) * 0.6 };
  }

  /* ---------- Dibujo ---------- */

  function levelFor(size) { return size >= 120 ? 'xl' : size >= 64 ? 'l' : size >= 32 ? 'm' : 's'; }

  function ensureDefs() {
    if (document.getElementById('oj2-defs')) return;
    var host = document.createElementNS(NS, 'svg');
    host.setAttribute('id', 'oj2-defs'); host.setAttribute('width', '0'); host.setAttribute('height', '0');
    host.setAttribute('aria-hidden', 'true'); host.style.cssText = 'position:absolute;width:0;height:0;color:var(--rd-ink)';
    host.innerHTML = '<defs>'
      + '<linearGradient id="oj2-ink" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity=".97"/><stop offset=".6" stop-color="currentColor" stop-opacity=".92"/><stop offset="1" stop-color="currentColor" stop-opacity=".78"/></linearGradient>'
      + '<linearGradient id="oj2-rim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".62"/></linearGradient>'
      + '<radialGradient id="oj2-shadow"><stop offset="0" stop-color="currentColor" stop-opacity=".42"/><stop offset=".5" stop-color="currentColor" stop-opacity=".16"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></radialGradient>'
      + '<radialGradient id="oj2-halo"><stop offset="0" stop-color="#fff" stop-opacity=".7"/><stop offset=".55" stop-color="#fff" stop-opacity=".3"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>'
      + '</defs>';
    document.body.insertBefore(host, document.body.firstChild);
  }

  function glassesFrame(recipe, a, b, k, scale, level) {
    var stroke = round(Math.max(1.9, 1.3 / scale));
    var w = a * k + 4.4, h = Math.max(b * k * 0.95, a * k) + 3.4;
    var style = recipe.glasses, left = 50 - recipe.gap, right = 50 + recipe.gap, y = recipe.cy;
    if (style === 'redondo') { w = h = Math.max(w, h); }
    if (style === 'pantos') { w = w + 1.6; h = h * 0.88; }
    var parts = [];
    function lens(cx) {
      var x = round(cx - w), top = round(y - h), wide = round(w * 2), tall = round(h * 2);
      var rx = style === 'redondo' ? w : style === 'pantos' ? Math.min(w, h) : style === 'ceja' ? 3 : 5.6;
      var out = '<rect x="' + x + '" y="' + top + '" width="' + wide + '" height="' + tall + '" rx="' + round(rx) + '" fill="#fff" fill-opacity=".12"/>';
      if (style === 'ceja') {
        out += '<path d="M' + x + ' ' + round(top + 2.4) + 'V' + round(top + 0.5) + 'H' + round(x + wide) + 'V' + round(top + 2.4) + '" fill="none" stroke="currentColor" stroke-opacity=".92" stroke-width="' + round(stroke * 1.9) + '" stroke-linecap="round" stroke-linejoin="round"/>';
        out += '<path d="M' + x + ' ' + round(top + 3) + 'V' + round(y + h - 5) + 'Q' + x + ' ' + round(y + h) + ' ' + round(x + 5) + ' ' + round(y + h) + 'H' + round(x + wide - 5) + 'Q' + round(x + wide) + ' ' + round(y + h) + ' ' + round(x + wide) + ' ' + round(y + h - 5) + 'V' + round(top + 3) + '" fill="none" stroke="currentColor" stroke-opacity=".5" stroke-width="' + round(stroke * 0.7) + '" stroke-linecap="round"/>';
      } else {
        out += '<rect x="' + x + '" y="' + top + '" width="' + wide + '" height="' + tall + '" rx="' + round(rx) + '" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="' + stroke + '" transform="translate(.55 .6)"/>';
        out += '<rect x="' + x + '" y="' + top + '" width="' + wide + '" height="' + tall + '" rx="' + round(rx) + '" fill="none" stroke="currentColor" stroke-opacity=".92" stroke-width="' + stroke + '"/>';
      }
      if (level === 'xl' || level === 'l') out += '<path d="M' + round(cx - w * 0.68) + ' ' + round(y - h * 0.15) + 'Q' + round(cx - w * 0.64) + ' ' + round(y - h * 0.62) + ' ' + round(cx - w * 0.2) + ' ' + round(y - h * 0.72) + '" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width="' + round(Math.max(1.1, 0.8 / scale)) + '" stroke-linecap="round"/>';
      return out;
    }
    parts.push(lens(left), lens(right));
    parts.push('<path d="M' + round(left + w) + ' ' + round(y - h * 0.2) + 'Q50 ' + round(y - h * 0.62) + ' ' + round(right - w) + ' ' + round(y - h * 0.2) + '" fill="none" stroke="currentColor" stroke-opacity=".92" stroke-width="' + stroke + '" stroke-linecap="round"/>');
    parts.push('<path d="M' + round(left - w) + ' ' + round(y - h * 0.3) + 'L' + round(left - w - 5) + ' ' + round(y - h * 0.46) + 'M' + round(right + w) + ' ' + round(y - h * 0.3) + 'L' + round(right + w + 5) + ' ' + round(y - h * 0.46) + '" fill="none" stroke="currentColor" stroke-opacity=".92" stroke-width="' + stroke + '" stroke-linecap="round"/>');
    return '<g>' + parts.join('') + '</g>';
  }

  function eyeMarkup(recipe, level, a, b, side, id) {
    var m = -side, big = level === 'xl' || level === 'l';
    var out = '<g data-eye="' + side + '">';
    if (level === 's') {
      out += '<ellipse cx="0" cy="0.6" rx="' + round(a * 2.1) + '" ry="' + round(b * 1.9) + '" fill="url(#oj2-halo)"/>';
      out += '<g data-body transform="scale(' + m + ' 1)"><path d="' + (recipe.kind === 'arco' ? arcPath(a, b) : outline(recipe.kind, a, b)) + '"' + (recipe.kind === 'arco' ? ' fill="none" stroke="currentColor" stroke-width="' + round(a * 0.7) + '" stroke-linecap="round"' : ' fill="url(#oj2-ink)"') + '/></g></g>';
      return out;
    }
    out += '<ellipse data-shadow cx="' + round(a * 0.2 + 0.7) + '" cy="' + round(b * 0.3 + 1.7) + '" rx="' + round(a * 1.9) + '" ry="' + round(b * 1.45 + 1) + '" fill="url(#oj2-shadow)"/>';
    if (recipe.kind === 'arco') {
      out += '<g data-body><path data-arc d="' + arcPath(a, b) + '" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="' + round(a * 0.5 + 0.8) + '" stroke-linecap="round" transform="translate(.8 1)"/>'
        + '<path data-arc d="' + arcPath(a, b) + '" fill="none" stroke="url(#oj2-ink)" stroke-width="' + round(a * 0.5) + '" stroke-linecap="round"/></g></g>';
      return out;
    }
    var d = outline(recipe.kind, a, b);
    out += '<g clip-path="url(#' + id + ')"><g transform="scale(' + m + ' 1)">'
      + '<path d="' + d + '" fill="#fff" fill-opacity=".16" transform="translate(1 1.2)"/>'
      + '<path d="' + d + '" fill="url(#oj2-ink)"/>'
      + '<path d="' + d + '" fill="none" stroke="url(#oj2-rim)" stroke-width="' + (big ? 0.9 : 1.1) + '" stroke-linejoin="round"/>'
      + (big && recipe.lashes ? '<path d="M' + round(-a * 0.9) + ' ' + round(-b * 0.42) + 'L' + round(-a - 2.8) + ' ' + round(-b * 0.42 - 2.2) + '" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' : '')
      + '</g>'
      + '<ellipse cx="' + round(a * 0.1) + '" cy="' + round(b * 0.72) + '" rx="' + round(a * 0.85) + '" ry="' + round(b * 0.38) + '" fill="url(#oj2-halo)" opacity=".55"/>'
      + '<ellipse cx="' + round(-a * 0.36) + '" cy="' + round(-b * 0.44) + '" rx="' + round(Math.max(1, a * 0.27)) + '" ry="' + round(clamp(b * 0.21, 1.1, 2.5)) + '" fill="#fff" opacity=".96"/>'
      + (big ? '<ellipse cx="' + round(a * 0.42) + '" cy="' + round(b * 0.5) + '" rx=".6" ry=".6" fill="#fff" opacity=".5"/>' : '')
      + '</g>'
      + '<path data-close d="M' + -a + ' ' + round(b * 0.05) + 'Q0 ' + round(b * 0.42) + ' ' + a + ' ' + round(b * 0.05) + '" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" opacity="0"/>'
      + '<clipPath id="' + id + '"><path data-lid d="' + lidPath(a, b, 0, 0, 0) + '"/></clipPath></g>';
    return out;
  }

  function marksMarkup(recipe, a, b, k) {
    if (!recipe.mark) return '';
    var below = recipe.cy + b * k + 6;
    if (recipe.mark === 'lunar') return '<circle cx="' + round(50 + recipe.gap + a * k * 0.55 + 2.4) + '" cy="' + round(below + 2) + '" r="1.05" fill="currentColor" opacity=".6"/>';
    var out = '';
    [[-1, 0], [-1, 1.9], [1, 0], [1, 1.9]].forEach(function (spot, index) {
      var x = 50 + spot[0] * (recipe.gap + a * k * 0.15 + 3.6 + (index % 2) * 1.6);
      out += '<circle cx="' + round(x) + '" cy="' + round(below + spot[1] * 1.3) + '" r=".75" fill="currentColor" opacity=".34"/>';
    });
    return out;
  }

  function mount(node, seed, options) {
    ensureDefs();
    var settings = options || {};
    var recipe = settings.recipe || TEAM[seed] || recipeFor(seed);
    var size = settings.size || 92;
    var level = settings.level || levelFor(size);
    var scale = size / 100;
    var kind = recipe.kind;
    if (level === 's' && (kind === 'almendra' || kind === 'huevo')) kind = 'ovalo';
    var live = {}; for (var key in recipe) live[key] = recipe[key]; live.kind = kind;
    if (level === 's') { live.lashes = false; live.brow = null; live.mark = null; live.glasses = null; }
    var k = level === 's' ? 1.5 : level === 'm' ? 1.12 : 1;
    var a = round(live.a), b = halfHeight(live);
    if (level === 's') live.gap = Math.max(live.gap * 0.92, a * k + 3.4);
    var glasses = live.glasses && level !== 's';
    var out = ['<svg viewBox="0 0 100 100" aria-hidden="true" width="100%" height="100%" fill="currentColor" style="pointer-events:none">'];
    var eyes = [[-1, 50 - live.gap], [1, 50 + live.gap]];
    eyes.forEach(function (eye, index) {
      var ab = index ? round(a * live.asym) : a;
      clipCount += 1;
      out.push(eyeMarkup(live, level, ab, round(ab * live.tall), eye[0], 'oj2c' + clipCount));
    });
    if (glasses) out.push(glassesFrame(live, a, b, k, scale, level));
    if (live.brow && (level === 'xl' || level === 'l')) {
      eyes.forEach(function (eye, index) {
        var raised = live.brow === 'alzada' && live.browSide === eye[0] ? 1 : 0;
        var shape = live.brow === 'alzada' && !raised ? BROWS.plana : BROWS[live.brow];
        out.push('<g data-brow="' + eye[0] + '" data-lift="' + (raised ? 2.6 : 0) + '"><path d="' + shape + '" transform="scale(' + -eye[0] + ' 1)" fill="none" stroke="currentColor" stroke-opacity=".72" stroke-width="' + round(Math.max(2.4, 1.5 / scale)) + '" stroke-linecap="round"/></g>');
      });
    }
    if (level === 'xl' || level === 'l') out.push(marksMarkup(live, a, b, k));
    out.push('</svg>');
    node.insertAdjacentHTML('beforeend', out.join(''));
    var svg = node.lastElementChild;
    var face = {
      node: node, svg: svg, recipe: live, seedInt: hashText('ojos2:' + seed), size: size, level: level, k: k, a: a, b: b,
      reach: glasses ? [2.2, 1.6] : [3.6, 2.4], x: [eyes[0][1], eyes[1][1]], arcs: kind === 'arco',
      eyes: Array.prototype.map.call(svg.querySelectorAll('[data-eye]'), function (g) {
        return { g: g, lid: g.querySelector('[data-lid]'), close: g.querySelector('[data-close]'), shadow: g.querySelector('[data-shadow]'), body: g.querySelector('[data-body]') };
      }),
      brows: Array.prototype.slice.call(svg.querySelectorAll('[data-brow]')),
      group: settings.group || null, index: 0, cx: 0, cy: 0, aim: null, near: 0, hover: 0, hoverTarget: 0
    };
    if (face.group) { face.index = face.group.faces.length; face.group.faces.push(face); }
    node.addEventListener('pointerenter', function () { face.hoverTarget = 1; });
    node.addEventListener('pointerleave', function () { face.hoverTarget = 0; });
    faces.push(face);
    return face;
  }

  function group() { groupCount += 1; return { seed: hashText('grupo' + groupCount), faces: [] }; }

  /* ---------- Cuadro ---------- */

  function measure() {
    faces.forEach(function (face) {
      var box = face.node.getBoundingClientRect();
      face.cx = box.left + box.width / 2; face.cy = box.top + box.height / 2;
    });
  }

  function apply(face, t, pointer) {
    var base = pose(face.recipe, face.seedInt, t);
    var gx = base.gx, gy = base.gy;
    var look = glance(face, t);
    if (look) { gx += (look.gx - gx) * look.amount; gy += (look.gy - gy) * look.amount; }
    if (pointer && face.near > 0.001) {
      var dx = pointer.x - face.cx, dy = pointer.y - face.cy, reach = face.size * 0.9 + 40;
      gx += (clamp(dx / reach, -1, 1) - gx) * face.near; gy += (clamp(dy / reach, -1, 1) * 0.75 - gy) * face.near;
    }
    var shut = base.shut, squint = face.hover;
    var recipe = face.recipe, k = face.k, tilt = recipe.tilt;
    var sizeLift = face.level === 's' ? 0 : squint * 1.1;
    face.eyes.forEach(function (eye, index) {
      var side = index ? 1 : -1;
      var a = index ? round(face.a * recipe.asym) : face.a, b = round(a * recipe.tall);
      var turn = Math.max(0, gx * side), away = Math.max(0, -gx * side);
      var sx = k * (1 - 0.15 * turn + 0.04 * away);
      var px = face.x[index] + gx * face.reach[0], py = recipe.cy + gy * face.reach[1] - sizeLift;
      var sy = k;
      if (face.arcs) sy = k * (1 - 0.6 * shut + 0.16 * squint);
      else if (face.level === 's') sy = k * (1 - 0.94 * shut);
      else sy = k * (1 - 0.22 * squint);
      eye.g.setAttribute('transform', 'translate(' + round(px) + ' ' + round(py) + ') scale(' + round(sx) + ' ' + round(sy) + ') rotate(' + round(-tilt * side) + ')');
      if (eye.lid) {
        var lid = recipe.lid + (1 - recipe.lid) * shut + 0.07 * Math.max(0, gy);
        eye.lid.setAttribute('d', lidPath(a, b, Math.min(lid, 1), squint * 0.62, recipe.slant * -side));
        eye.close.setAttribute('opacity', round(smooth((shut - 0.72) / 0.25)));
      }
      if (eye.shadow) eye.shadow.setAttribute('opacity', round((1 - shut * 0.75) * (1 - squint * 0.7)));
    });
    face.brows.forEach(function (brow) {
      var side = Number(brow.getAttribute('data-brow')), index = side > 0 ? 1 : 0;
      var lift = Number(brow.getAttribute('data-lift'));
      var y = recipe.cy - face.b * k - 4.6 - lift + shut * 1.6 - squint * 1.6 + gy * 1.1;
      brow.setAttribute('transform', 'translate(' + round(face.x[index] + gx * 1.5) + ' ' + round(y) + ')');
    });
  }

  var pointer = null, started = false;

  function start(t) {
    var reduced = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    measure();
    if (typeof t === 'number') { faces.forEach(function (face) { apply(face, t, null); }); return null; }
    if (reduced) { faces.forEach(function (face) { apply(face, 0, null); }); return null; }
    if (started) return null;
    started = true;
    root.addEventListener('pointermove', function (event) { pointer = { x: event.clientX, y: event.clientY, at: performance.now() }; });
    document.documentElement.addEventListener('pointerleave', function () { pointer = null; });
    root.addEventListener('resize', measure);
    root.addEventListener('scroll', measure, { passive: true });
    var last = performance.now(), frame = 0;
    function loop(now) {
      frame += 1;
      var dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (frame % 2 === 0) {
        var follow = pointer && now - pointer.at < 4000;
        faces.forEach(function (face) {
          var want = 0;
          if (follow) { var dx = pointer.x - face.cx, dy = pointer.y - face.cy; want = 1 - smooth((Math.sqrt(dx * dx + dy * dy) - 90) / 420); }
          face.near += (want - face.near) * (1 - Math.exp(-dt * 14));
          face.hover += (face.hoverTarget - face.hover) * (1 - Math.exp(-dt * 16));
          apply(face, now / 1000, follow ? pointer : null);
        });
      }
      root.requestAnimationFrame(loop);
    }
    root.requestAnimationFrame(loop);
    return null;
  }

  root.RondaOjos2 = { mount: mount, group: group, start: start, recipeFor: recipeFor, levelFor: levelFor, TEAM: TEAM, TEAM_LIGHT: TEAM_LIGHT };
})(window);
