/*
 * Ronda · caras. Cada persona es una gota de vidrio con su lámpara de lava adentro, y solo tiene ojos.
 * Todo el carácter sale de la forma de los ojos, los anteojos, una ceja, cómo miran y cómo parpadean.
 * Decisión de Mati del 21-nov-2026: estas son las caras del producto. Regla y estados: design/DESIGN.md § Caras.
 *
 *   var cara = RondaCaras.mount(nodo, nombre, opciones)   monta una cara dentro de nodo (queda con la clase rd-cara)
 *       nombre    el nombre de la persona. El mismo nombre da siempre la misma cara y los mismos colores.
 *                 El equipo se reconoce por su primer nombre: mati, ian, lian, andres, roberto.
 *       opciones  size (px; si falta se mide el nodo), state, interactive (true: reacciona al puntero),
 *                 trigger (otro elemento cuyo puntero y foco mueven la cara, por ejemplo la fila que la contiene),
 *                 light (true: la cara trae su propia lava), group (caras que se miran entre sí), palette, recipe,
 *                 level (xl, l, m o s: cuánto detalle, si no se quiere el que da el tamaño), rest (true: ojos abiertos
 *                 y mirada al frente, para una imagen quieta), enter (false: sin la entrada con rebote)
 *   cara.set(estado)        reposo | activa | pensando | lista | ausente
 *   cara.pulse()            un saltito con onda y parpadeo, para avisar que llegó algo de esa persona
 *   cara.hold({ hover, press })   fija hover o presionada sin puntero (para mostrar el estado o para pruebas)
 *   cara.destroy()
 *   RondaCaras.group()      un grupo de caras vecinas
 *   RondaCaras.still(t)     detiene la animación y deja todas las caras en el instante t (capturas)
 *   RondaCaras.STATES, RondaCaras.TEAM, RondaCaras.TEAM_LIGHT, RondaCaras.recipeFor(nombre), RondaCaras.keyFor(nombre),
 *   RondaCaras.lightFor(nombre)
 *
 * Hover y presionada no son estados que se fijan: salen solos del puntero, del foco y del teclado.
 * Necesita design/luz/luz.js cargado antes (la lava) y las clases rd-cara de design/ronda.css.
 * Con prefers-reduced-motion la cara queda quieta y los cambios de estado son inmediatos.
 */
(function (root) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var STATES = ['reposo', 'activa', 'pensando', 'lista', 'ausente'];
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

  /* ---------- Recetas: qué ojos tiene cada persona ---------- */

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

  var PLAIN = { glasses: null, brow: null, lashes: false, mark: null, asym: 1, lid: 0, slant: 0 };
  function teammate(extra, seed) {
    var recipe = recipeFor(seed), key;
    for (key in PLAIN) recipe[key] = PLAIN[key];
    for (key in extra) recipe[key] = extra[key];
    return tidy(recipe);
  }

  // El equipo, dicho con los ojos: cada cual con su forma, su ceja y su manera de mirar.
  var TEAM = {
    mati: teammate({ kind: 'capsula', a: 4.7, tall: 2.2, gap: 12.8, cy: 51.5, tilt: 0, brow: 'alzada', browSide: 1, rest: [0.12, 0], blink: { period: 4.1, phase: 0.18 }, gaze: { period: 7.2, phase: 0.1, range: 0.8 } }, 'mati'),
    ian: teammate({ kind: 'arco', a: 7, tall: 0.9, gap: 14.6, cy: 52.4, tilt: 0, mark: 'pecas', rest: [0, 0.05], blink: { period: 3.6, phase: 0.62 }, gaze: { period: 5.9, phase: 0.45, range: 0.9 } }, 'ian'),
    lian: teammate({ kind: 'ovalo', a: 4.8, tall: 1.25, gap: 15.6, cy: 52.2, tilt: 0, glasses: 'redondo', rest: [0, 0], blink: { period: 4.8, phase: 0.33 }, gaze: { period: 8.4, phase: 0.7, range: 0.55 } }, 'lian'),
    andres: teammate({ kind: 'almendra', a: 6.7, tall: 1.05, gap: 13.4, cy: 51.4, tilt: 4, brow: 'alzada', browSide: -1, rest: [0.3, 0.1], blink: { period: 3.9, phase: 0.05 }, gaze: { period: 6.4, phase: 0.85, range: 0.7 } }, 'andres'),
    roberto: teammate({ kind: 'cuenta', a: 5.6, tall: 1, gap: 14.8, cy: 52.6, tilt: -1, lid: 0.27, slant: -0.5, mark: 'lunar', rest: [0, 0.1], blink: { period: 5.6, phase: 0.8 }, gaze: { period: 9.1, phase: 0.3, range: 0.6 } }, 'roberto')
  };
  // Tonos de la rueda de design/luz/luz.js para la lava de cada integrante.
  var TEAM_LIGHT = { mati: [0, 9, 8, 1], ian: [5, 7, 4, 6], lian: [9, 8, 7, 10], roberto: [6, 5, 8, 7], andres: [2, 1, 3, 0] };

  // «Andrés Pérez», «andres» y «Andrés» son la misma persona del equipo; el resto se reconoce por su nombre completo.
  var ALIASES = { robert: 'roberto', matias: 'mati' };
  function keyFor(name) {
    var plain = String(name).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
    var first = plain.split(' ')[0];
    first = ALIASES[first] || first;
    return TEAM[first] ? first : plain;
  }

  // La luz de una persona: sus cuatro tonos, la semilla que mueve su cera y el desfase de su reloj.
  // La usa esta misma pieza y quien dibuja la lava por su cuenta (la lámina de design/caras/atlas.html).
  function lightFor(name) {
    var seed = keyFor(name), Luz = root.RondaLuz;
    return {
      palette: TEAM_LIGHT[seed] || (Luz ? Luz.paletteFor(seed) : [0, 1, 9, 8]),
      seed: 0.05 + 0.9 * ((hashText('ojos2:' + seed) % 9973) / 9973),
      offset: (hashText('fase:' + seed) % 4000) / 100
    };
  }

  /* ---------- Forma del ojo, para el izquierdo: la comisura externa mira a -x ---------- */

  function outline(kind, a, b) {
    switch (kind) {
      case 'capsula': { var r = Math.min(a, b); return 'M' + -a + ' ' + (-b + r) + 'A' + a + ' ' + r + ' 0 0 1 ' + a + ' ' + (-b + r) + 'V' + (b - r) + 'A' + a + ' ' + r + ' 0 0 1 ' + -a + ' ' + (b - r) + 'Z'; }
      case 'almendra': return 'M' + -a + ' ' + round(b * 0.2) + 'C' + round(-a * 0.7) + ' ' + round(-b * 1.05) + ' ' + round(a * 0.7) + ' ' + round(-b * 1.15) + ' ' + a + ' ' + round(-b * 0.15) + 'C' + round(a * 0.6) + ' ' + round(b * 0.95) + ' ' + round(-a * 0.5) + ' ' + round(b * 1.05) + ' ' + -a + ' ' + round(b * 0.2) + 'Z';
      case 'huevo': return 'M0 ' + -b + 'C' + round(a * 0.62) + ' ' + -b + ' ' + a + ' ' + round(-b * 0.25) + ' ' + a + ' ' + round(b * 0.1) + 'C' + a + ' ' + round(b * 0.7) + ' ' + round(a * 0.55) + ' ' + b + ' 0 ' + b + 'C' + round(-a * 0.55) + ' ' + b + ' ' + -a + ' ' + round(b * 0.7) + ' ' + -a + ' ' + round(b * 0.1) + 'C' + -a + ' ' + round(-b * 0.25) + ' ' + round(-a * 0.62) + ' ' + -b + ' 0 ' + -b + 'Z';
      default: return 'M' + -a + ' 0A' + a + ' ' + b + ' 0 1 1 ' + a + ' 0A' + a + ' ' + b + ' 0 1 1 ' + -a + ' 0Z';
    }
  }
  function arcPath(a, b) { return 'M' + -a + ' ' + round(b * 0.55) + 'Q0 ' + round(-b * 1.5) + ' ' + a + ' ' + round(b * 0.55); }

  // Lo que dejan ver los párpados. lid baja el de arriba (0 abierto, 1 cerrado); squint sube el de abajo en curva, como al sonreír.
  function lidPath(a, b, lid, squint, slant) {
    var w = round(a + 4);
    var top = -b - 3 + lid * (2 * b + 3.2);
    var low = b + 3 - squint * (b + 2.6);
    top = Math.min(top, low - 0.4);
    var bend = low - squint * b * 1.7;
    var sl = slant * Math.min(1, lid * 3);
    return 'M' + -w + ' ' + round(top + sl) + 'Q0 ' + round(top + 0.9 * lid) + ' ' + w + ' ' + round(top - sl) + 'L' + w + ' ' + round(low) + 'Q0 ' + round(bend) + ' ' + -w + ' ' + round(low) + 'Z';
  }

  var BROWS = { plana: 'M-5.6 1Q0 -0.8 5.6 1', arco: 'M-5.6 2Q-0.6 -2.4 5.6 0.8', alzada: 'M-5.6 1.8Q0 -2.4 5.6 0.2' };

  /* ---------- Vida en reposo: mirada y parpadeo como función pura del instante ---------- */

  function gazeTarget(seedInt, k, recipe) {
    var calm = mix(seedInt, k, 1) < 0.4, spread = recipe.gaze.range;
    return [recipe.rest[0] + (calm ? 0 : (mix(seedInt, k, 2) * 2 - 1) * spread), recipe.rest[1] + (calm ? 0 : (mix(seedInt, k, 3) * 2 - 1) * spread * 0.6)];
  }
  function closing(seconds, duration) {
    if (seconds < 0 || seconds > duration) return 0;
    var u = seconds / duration;
    return u < 0.36 ? smooth(u / 0.36) : 1 - smooth((u - 0.36) / 0.64);
  }
  function pose(recipe, seedInt, t) {
    var gu = t / recipe.gaze.period + recipe.gaze.phase, gk = Math.floor(gu);
    var blend = smooth((gu - gk) * recipe.gaze.period / 0.7);
    var from = gazeTarget(seedInt, gk - 1, recipe), to = gazeTarget(seedInt, gk, recipe);
    var bu = t / recipe.blink.period + recipe.blink.phase, bk = Math.floor(bu);
    var seconds = (bu - bk) * recipe.blink.period;
    var onset = recipe.blink.period * (0.12 + 0.55 * mix(seedInt, bk, 5));
    var shut = closing(seconds - onset, 0.22);
    if (mix(seedInt, bk, 6) < 0.16) shut = Math.max(shut, closing(seconds - onset - 0.32, 0.22));
    return { gx: from[0] + (to[0] - from[0]) * blend, gy: from[1] + (to[1] - from[1]) * blend, shut: shut };
  }
  // Cada tanto dos vecinas de un grupo se miran.
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

  /* ---------- Dibujo de los ojos ---------- */

  function levelFor(size) { return size >= 120 ? 'xl' : size >= 64 ? 'l' : size >= 32 ? 'm' : 's'; }

  function ensureDefs() {
    if (document.getElementById('rd-cara-defs')) return;
    var host = document.createElementNS(NS, 'svg');
    host.setAttribute('id', 'rd-cara-defs'); host.setAttribute('width', '0'); host.setAttribute('height', '0');
    host.setAttribute('aria-hidden', 'true'); host.style.cssText = 'position:absolute;width:0;height:0;color:var(--rd-ink)';
    host.innerHTML = '<defs>'
      + '<linearGradient id="rd-cara-tinta" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity=".97"/><stop offset=".6" stop-color="currentColor" stop-opacity=".92"/><stop offset="1" stop-color="currentColor" stop-opacity=".78"/></linearGradient>'
      + '<linearGradient id="rd-cara-borde" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".62"/></linearGradient>'
      + '<radialGradient id="rd-cara-sombra"><stop offset="0" stop-color="currentColor" stop-opacity=".42"/><stop offset=".5" stop-color="currentColor" stop-opacity=".16"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></radialGradient>'
      + '<radialGradient id="rd-cara-rubor"><stop offset="0" style="stop-color:var(--rd-g4)" stop-opacity=".5"/><stop offset=".55" style="stop-color:var(--rd-g4)" stop-opacity=".2"/><stop offset="1" style="stop-color:var(--rd-g4)" stop-opacity="0"/></radialGradient>'
      + '<radialGradient id="rd-cara-halo"><stop offset="0" stop-color="#fff" stop-opacity=".7"/><stop offset=".55" stop-color="#fff" stop-opacity=".3"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>'
      + '</defs>';
    document.body.insertBefore(host, document.body.firstChild);
  }

  function glassesFrame(recipe, a, b, k, scale, level) {
    var stroke = round(Math.max(1.9, 1.3 / scale));
    var w = a * k + 4.4, h = Math.max(b * k * 0.95, a * k) + 3.4;
    var style = recipe.glasses, left = 50 - recipe.gap, right = 50 + recipe.gap, y = recipe.cy;
    if (style === 'redondo') { w = h = Math.max(w, h); }
    if (style === 'pantos') { w = w + 1.6; h = h * 0.88; }
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
    return '<g>' + lens(left) + lens(right)
      + '<path d="M' + round(left + w) + ' ' + round(y - h * 0.2) + 'Q50 ' + round(y - h * 0.62) + ' ' + round(right - w) + ' ' + round(y - h * 0.2) + '" fill="none" stroke="currentColor" stroke-opacity=".92" stroke-width="' + stroke + '" stroke-linecap="round"/>'
      + '<path d="M' + round(left - w) + ' ' + round(y - h * 0.3) + 'L' + round(left - w - 5) + ' ' + round(y - h * 0.46) + 'M' + round(right + w) + ' ' + round(y - h * 0.3) + 'L' + round(right + w + 5) + ' ' + round(y - h * 0.46) + '" fill="none" stroke="currentColor" stroke-opacity=".92" stroke-width="' + stroke + '" stroke-linecap="round"/></g>';
  }

  function eyeMarkup(recipe, level, a, b, side, id) {
    var m = -side, big = level === 'xl' || level === 'l';
    var out = '<g data-eye="' + side + '">';
    if (level === 's') {
      out += '<ellipse cx="0" cy="0.6" rx="' + round(a * 2.1) + '" ry="' + round(b * 1.9) + '" fill="url(#rd-cara-halo)"/>';
      out += '<g transform="scale(' + m + ' 1)"><path d="' + (recipe.kind === 'arco' ? arcPath(a, b) : outline(recipe.kind, a, b)) + '"' + (recipe.kind === 'arco' ? ' fill="none" stroke="currentColor" stroke-width="' + round(a * 0.7) + '" stroke-linecap="round"' : ' fill="url(#rd-cara-tinta)"') + '/></g></g>';
      return out;
    }
    out += '<ellipse data-shadow cx="' + round(a * 0.2 + 0.7) + '" cy="' + round(b * 0.3 + 1.7) + '" rx="' + round(a * 1.9) + '" ry="' + round(b * 1.45 + 1) + '" fill="url(#rd-cara-sombra)"/>';
    if (recipe.kind === 'arco') {
      out += '<g><path d="' + arcPath(a, b) + '" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="' + round(a * 0.5 + 0.8) + '" stroke-linecap="round" transform="translate(.8 1)"/>'
        + '<path d="' + arcPath(a, b) + '" fill="none" stroke="url(#rd-cara-tinta)" stroke-width="' + round(a * 0.5) + '" stroke-linecap="round"/></g></g>';
      return out;
    }
    var d = outline(recipe.kind, a, b);
    var joyWide = round(Math.max(a * 1.2, 5.2)), joyTall = round(clamp(b * 0.62, 2.8, 4.1)), joyInk = round(clamp(a * 0.55, 2.8, 3.4));
    out += '<g data-body><g clip-path="url(#' + id + ')"><g transform="scale(' + m + ' 1)">'
      + '<path d="' + d + '" fill="#fff" fill-opacity=".16" transform="translate(1 1.2)"/>'
      + '<path d="' + d + '" fill="url(#rd-cara-tinta)"/>'
      + '<path d="' + d + '" fill="none" stroke="url(#rd-cara-borde)" stroke-width="' + (big ? 0.9 : 1.1) + '" stroke-linejoin="round"/>'
      + (big && recipe.lashes ? '<path d="M' + round(-a * 0.9) + ' ' + round(-b * 0.42) + 'L' + round(-a - 2.8) + ' ' + round(-b * 0.42 - 2.2) + '" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' : '')
      + '</g>'
      + '<ellipse cx="' + round(a * 0.1) + '" cy="' + round(b * 0.72) + '" rx="' + round(a * 0.85) + '" ry="' + round(b * 0.38) + '" fill="url(#rd-cara-halo)" opacity=".55"/>'
      + '<ellipse data-glint cx="' + round(-a * 0.36) + '" cy="' + round(-b * 0.44) + '" rx="' + round(Math.max(1, a * 0.27)) + '" ry="' + round(clamp(b * 0.21, 1.1, 2.5)) + '" fill="#fff" opacity=".96"/>'
      + (big ? '<ellipse cx="' + round(a * 0.42) + '" cy="' + round(b * 0.5) + '" rx=".6" ry=".6" fill="#fff" opacity=".5"/>' : '')
      + '</g>'
      + '</g>'
      + '<path data-close d="M' + -a + ' ' + round(b * 0.05) + 'Q0 ' + round(b * 0.42) + ' ' + a + ' ' + round(b * 0.05) + '" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" opacity="0"/>'
      + '<g data-joy opacity="0"><path d="' + arcPath(joyWide, joyTall) + '" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="' + round(joyInk + 0.8) + '" stroke-linecap="round" transform="translate(.7 .9)"/>'
      + '<path d="' + arcPath(joyWide, joyTall) + '" fill="none" stroke="url(#rd-cara-tinta)" stroke-width="' + joyInk + '" stroke-linecap="round"/></g>'
      + '<clipPath id="' + id + '"><path data-lid d="' + lidPath(a, b, 0, 0, 0) + '"/></clipPath></g>';
    return out;
  }

  function marksMarkup(recipe, a, b, k) {
    if (!recipe.mark) return '';
    var below = recipe.cy + b * k + 6;
    if (recipe.mark === 'lunar') return '<circle cx="' + round(50 + recipe.gap + a * k * 0.55 + 2.4) + '" cy="' + round(below + 2) + '" r="1.05" fill="currentColor" opacity=".6"/>';
    return [[-1, 0], [-1, 1.9], [1, 0], [1, 1.9]].map(function (spot, index) {
      var x = 50 + spot[0] * (recipe.gap + a * k * 0.15 + 3.6 + (index % 2) * 1.6);
      return '<circle cx="' + round(x) + '" cy="' + round(below + spot[1] * 1.3) + '" r=".75" fill="currentColor" opacity=".34"/>';
    }).join('');
  }

  function eyesMarkup(face) {
    var live = face.recipe, level = face.level, a = face.a, b = face.b, k = face.k;
    var out = ['<svg viewBox="0 0 100 100" aria-hidden="true" width="100%" height="100%" fill="currentColor" style="pointer-events:none">'];
    var eyes = [[-1, 50 - live.gap], [1, 50 + live.gap]];
    eyes.forEach(function (eye, index) {
      var ab = index ? round(a * live.asym) : a;
      clipCount += 1;
      out.push(eyeMarkup(live, level, ab, round(ab * live.tall), eye[0], 'rd-cara-c' + clipCount));
    });
    if (face.glasses) out.push(glassesFrame(live, a, b, k, face.size / 100, level));
    if (live.brow && (level === 'xl' || level === 'l')) {
      eyes.forEach(function (eye) {
        var raised = live.brow === 'alzada' && live.browSide === eye[0] ? 1 : 0;
        var shape = live.brow === 'alzada' && !raised ? BROWS.plana : BROWS[live.brow];
        out.push('<g data-brow="' + eye[0] + '" data-lift="' + (raised ? 2.6 : 0) + '"><path d="' + shape + '" transform="scale(' + -eye[0] + ' 1)" fill="none" stroke="currentColor" stroke-opacity=".72" stroke-width="' + round(Math.max(2.4, 1.5 / (face.size / 100))) + '" stroke-linecap="round"/></g>');
      });
    }
    if (level === 'xl' || level === 'l') out.push(marksMarkup(live, a, b, k));
    if (level !== 's') {
      eyes.forEach(function (eye) {
        out.push('<ellipse data-blush cx="' + round(eye[1] + eye[0] * (a * k * 0.5 + 1.6)) + '" cy="' + round(live.cy + Math.min(b, 7.5) * k + 6.4) + '" rx="7.2" ry="4.6" fill="url(#rd-cara-rubor)" opacity="0"/>');
      });
    }
    out.push('</svg>');
    return out.join('');
  }

  /* ---------- La lava: tres láminas compartidas, por tamaño de cara; cada cara ocupa una celda ---------- */

  // Caben 36 caras grandes, 64 medianas y 256 chicas con lava viva a la vez. La que no cabe queda con su mezcla quieta.
  var SHEETS = [
    { min: 110, cell: 192, cols: 6, rows: 6, grid: undefined, slots: [], phases: null },
    { min: 44, cell: 128, cols: 8, rows: 8, grid: undefined, slots: [], phases: null },
    { min: 0, cell: 64, cols: 16, rows: 16, grid: undefined, slots: [], phases: null }
  ];

  function claim(face) {
    var Luz = root.RondaLuz, sheet = SHEETS[SHEETS.length - 1];
    for (var i = 0; i < SHEETS.length; i += 1) if (face.size >= SHEETS[i].min) { sheet = SHEETS[i]; break; }
    if (sheet.grid === undefined) {
      sheet.grid = Luz ? Luz.grid(document.createElement('canvas'), { cols: sheet.cols, rows: sheet.rows, cell: sheet.cell, palettes: [] }) : null;
      sheet.phases = new Float32Array(sheet.cols * sheet.rows);
    }
    if (!sheet.grid) return false;
    var slot = sheet.slots.indexOf(null);
    if (slot < 0) slot = sheet.slots.length;
    if (slot >= sheet.cols * sheet.rows) return false;
    sheet.slots[slot] = face;
    face.sheet = sheet; face.slot = slot;
    sheet.grid.setCell(slot, face.palette, face.light.seed);
    return true;
  }

  /* ---------- Montaje ---------- */

  function mount(node, name, options) {
    ensureDefs();
    var settings = options || {};
    var Luz = root.RondaLuz;
    var seed = keyFor(name), light = lightFor(name);
    var size = settings.size || node.clientWidth || 92;
    var level = settings.level || levelFor(size);
    var base = settings.recipe || TEAM[seed] || recipeFor(seed);
    var live = {}, key;
    for (key in base) live[key] = base[key];
    if (level === 's') {
      if (live.kind === 'almendra' || live.kind === 'huevo') live.kind = 'ovalo';
      live.lashes = false; live.brow = null; live.mark = null; live.glasses = null;
    }
    var k = level === 's' ? 1.5 : level === 'm' ? 1.12 : 1;
    var a = round(live.a), b = round(live.a * live.tall);
    if (level === 's') live.gap = Math.max(live.gap * 0.92, a * k + 3.4);

    var face = {
      node: node, seed: seed, seedInt: hashText('ojos2:' + seed), size: size, level: level, recipe: live, k: k, a: a, b: b,
      glasses: Boolean(live.glasses), reach: live.glasses ? [2.2, 1.6] : [3.6, 2.4], x: [50 - live.gap, 50 + live.gap], arcs: live.kind === 'arco',
      light: light, palette: settings.palette || light.palette, rest: Boolean(settings.rest),
      group: settings.group || null, trigger: settings.trigger || null, index: 0, cx: 0, cy: 0, near: 0, visible: true,
      state: 'reposo', held: { hover: false, press: false }, pointer: { hover: false, press: false },
      goal: { hover: 0, press: 0, active: 0, think: 0, done: 0, away: 0 },
      now: { hover: 0, press: 0, active: 0, think: 0, done: 0, away: 0 },
      scale: 1, scaleSpeed: 0, squish: 0, squishSpeed: 0, hop: 0, hopSpeed: 0, drawn: '', phase: light.offset, blinkAt: null
    };

    node.classList.add('rd-cara');
    node.classList.toggle('rd-cara--chica', size < 56);
    node.setAttribute('data-estado', 'reposo');
    node.innerHTML = '<span class="rd-cara__halo"></span><span class="rd-cara__anillo"></span><span class="rd-cara__gota"><canvas></canvas></span><span class="rd-cara__onda"></span>';
    face.drop = node.querySelector('.rd-cara__gota');
    face.canvas = face.drop.firstChild;
    node.lastChild.addEventListener('animationend', function () { node.classList.remove('is-onda'); });
    face.drop.insertAdjacentHTML('beforeend', eyesMarkup(face));
    face.svg = face.drop.lastElementChild;
    face.eyes = Array.prototype.map.call(face.svg.querySelectorAll('[data-eye]'), function (g) {
      return { g: g, lid: g.querySelector('[data-lid]'), close: g.querySelector('[data-close]'), shadow: g.querySelector('[data-shadow]'), glint: g.querySelector('[data-glint]'), body: g.querySelector('[data-body]'), joy: g.querySelector('[data-joy]') };
    });
    face.brows = Array.prototype.slice.call(face.svg.querySelectorAll('[data-brow]'));
    face.blush = Array.prototype.slice.call(face.svg.querySelectorAll('[data-blush]'));

    if (Luz) {
      var tone = Luz.tone(face.palette[0]).map(function (value) { return Math.round(value * 255); });
      node.style.setProperty('--rd-cara-luz', 'rgba(' + tone.join(', ') + ', 0.62)');
    }
    if (settings.light === false) {
      face.canvas.remove(); face.canvas = null;
    } else if (claim(face)) {
      var side = Math.max(2, Math.round(size * Math.min(2, root.devicePixelRatio || 1)));
      face.canvas.width = face.canvas.height = side;
      face.context = face.canvas.getContext('2d');
      face.context.imageSmoothingQuality = 'high';
    } else {
      face.canvas.remove(); face.canvas = null;
      if (Luz) face.drop.style.background = Luz.css(face.palette);
    }

    if (face.group) { face.index = face.group.faces.length; face.group.faces.push(face); }
    if (settings.interactive !== false) listen(face);
    if (root.IntersectionObserver) watcher().observe(node);

    face.set = function (state) { setState(face, state); return face; };
    face.pulse = function () { if (frozen == null && !reduced()) { face.hopSpeed = -face.size * 2; face.blinkAt = clock() + 0.12; ripple(face); } return face; };
    face.hold = function (flags) { face.held.hover = Boolean(flags && flags.hover); face.held.press = Boolean(flags && flags.press); syncPointer(face); return face; };
    face.destroy = function () { destroy(face); };
    faces.push(face);
    if (settings.state) setState(face, settings.state);
    measureSoon();
    start();
    if (frozen == null && settings.enter !== false) { face.scale = 0.88; face.drop.style.transform = 'scale(0.88)'; }
    else if (frozen != null) settle(face);
    return face;
  }

  function destroy(face) {
    var at = faces.indexOf(face);
    if (at >= 0) faces.splice(at, 1);
    if (face.sheet) face.sheet.slots[face.slot] = null;
    if (face.group) { var gi = face.group.faces.indexOf(face); if (gi >= 0) face.group.faces.splice(gi, 1); face.group.faces.forEach(function (other, index) { other.index = index; }); }
    if (face.unlisten) face.unlisten();
    if (seen) seen.unobserve(face.node);
    face.node.classList.remove('rd-cara', 'rd-cara--chica', 'is-hover', 'is-press', 'is-onda');
    face.node.removeAttribute('data-estado');
    face.node.innerHTML = '';
  }

  var seen = null;
  function watcher() {
    if (!seen) seen = new root.IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        for (var i = 0; i < faces.length; i += 1) if (faces[i].node === entry.target) { faces[i].visible = entry.isIntersecting; break; }
      });
    }, { rootMargin: '120px' });
    return seen;
  }

  /* ---------- Estados ---------- */

  function setState(face, state) {
    if (STATES.indexOf(state) < 0) state = 'reposo';
    var before = face.state;
    face.state = state;
    face.node.setAttribute('data-estado', state);
    face.goal.active = state === 'activa' ? 1 : 0;
    face.goal.think = state === 'pensando' ? 1 : 0;
    face.goal.done = state === 'lista' ? 1 : 0;
    face.goal.away = state === 'ausente' ? 1 : 0;
    if (state === 'lista' && before !== 'lista') { face.hopSpeed = -face.size * 2.4; ripple(face); }
    if (frozen != null) settle(face);
  }

  function syncPointer(face) {
    var hover = face.held.hover || face.pointer.hover, press = face.held.press || face.pointer.press;
    face.goal.hover = hover ? 1 : 0;
    face.goal.press = press ? 1 : 0;
    face.node.classList.toggle('is-hover', hover);
    face.node.classList.toggle('is-press', press);
    if (frozen != null) settle(face);
  }

  function ripple(face) {
    if (reduced()) return;
    face.node.classList.remove('is-onda');
    void face.node.offsetWidth;
    face.node.classList.add('is-onda');
  }

  function listen(face) {
    var node = face.trigger || face.node;
    function release(pop) {
      if (!face.pointer.press) return;
      face.pointer.press = false;
      syncPointer(face);
      if (pop) { face.blinkAt = clock() + 0.05; ripple(face); }
    }
    var handlers = {
      pointerenter: function () { face.pointer.hover = true; syncPointer(face); },
      pointerleave: function () { face.pointer.hover = false; release(false); syncPointer(face); },
      pointerdown: function (event) { if (event.pointerType === 'mouse' && event.button !== 0) return; face.pointer.press = true; syncPointer(face); },
      pointerup: function () { release(true); },
      pointercancel: function () { release(false); },
      focus: function () { if (node.matches(':focus-visible')) { face.pointer.hover = true; syncPointer(face); } },
      blur: function () { face.pointer.hover = false; release(false); syncPointer(face); },
      keydown: function (event) { if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) { face.pointer.press = true; syncPointer(face); } },
      keyup: function (event) { if (event.key === ' ' || event.key === 'Enter') release(true); }
    };
    Object.keys(handlers).forEach(function (name) { node.addEventListener(name, handlers[name]); });
    face.unlisten = function () { Object.keys(handlers).forEach(function (name) { node.removeEventListener(name, handlers[name]); }); };
  }

  /* ---------- Cuadro: ojos ---------- */

  function drawEyes(face, t, pointer) {
    var v = face.now, recipe = face.recipe, k = face.k;
    var base = face.rest ? { gx: recipe.rest[0], gy: recipe.rest[1], shut: 0 } : pose(recipe, face.seedInt, t);
    var gx = base.gx, gy = base.gy, shut = base.shut;
    var look = glance(face, t);
    if (look) { gx += (look.gx - gx) * look.amount; gy += (look.gy - gy) * look.amount; }
    gx += (recipe.rest[0] - gx) * 0.45 * v.active; gy += (recipe.rest[1] - gy) * 0.45 * v.active;
    if (v.think > 0.001) {
      var wander = 0.6 * Math.sin(t * 0.9 + (face.seedInt % 7)), up = -0.84 + 0.13 * Math.sin(t * 1.7 + (face.seedInt % 5));
      gx += (wander - gx) * v.think; gy += (up - gy) * v.think;
    }
    if (pointer && face.near > 0.001) {
      var dx = pointer.x - face.cx, dy = pointer.y - face.cy, reach = face.size * 0.9 + 40;
      gx += (clamp(dx / reach, -1, 1) - gx) * face.near; gy += (clamp(dy / reach, -1, 1) * 0.75 - gy) * face.near;
    }
    if (face.blinkAt != null) { shut = Math.max(shut, closing(t - face.blinkAt, 0.2)); if (t - face.blinkAt > 0.3) face.blinkAt = null; }
    gx *= 1 - v.away; gy *= 1 - v.away;
    var joy = smooth(v.done * 1.25) * (1 - v.away);
    shut = Math.max(shut * (1 - v.away) * (1 - joy), v.away);
    var wide = clamp(0.62 * v.hover + 0.42 * v.active - v.press - v.away - v.done, 0, 1);
    var squint = clamp(Math.max(v.done, 0.8 * v.press), 0, 1) * (1 - v.away);
    var grow = 1 + 0.09 * wide + (face.arcs ? 0.12 * joy : 0);
    var lift = face.level === 's' ? 0 : squint * 1.1;

    face.eyes.forEach(function (eye, index) {
      var side = index ? 1 : -1;
      var a = index ? round(face.a * recipe.asym) : face.a, b = round(a * recipe.tall);
      var turn = Math.max(0, gx * side), away = Math.max(0, -gx * side);
      var sx = k * grow * (1 - 0.15 * turn + 0.04 * away), sy;
      if (face.arcs) sy = k * grow * (1 - 0.6 * shut + 0.18 * squint);
      else if (face.level === 's') sy = k * grow * (1 - 0.94 * shut);
      else sy = k * grow * (1 - 0.2 * squint);
      eye.g.setAttribute('transform', 'translate(' + round(face.x[index] + gx * face.reach[0]) + ' ' + round(recipe.cy + gy * face.reach[1] - lift) + ') scale(' + round(sx) + ' ' + round(sy) + ') rotate(' + round(-recipe.tilt * side) + ')');
      if (eye.lid) {
        var lid = recipe.lid * (1 - 0.7 * wide);
        lid += (1 - lid) * Math.max(shut, 0.3 * v.think) + 0.07 * Math.max(0, gy);
        eye.lid.setAttribute('d', lidPath(a, b, Math.min(lid, 1), squint * 0.66, recipe.slant * -side));
        eye.close.setAttribute('opacity', round(smooth((shut - 0.72) / 0.25)));
      }
      if (eye.shadow) eye.shadow.setAttribute('opacity', round((1 - shut * 0.75) * (1 - squint * 0.7)));
      if (eye.glint) eye.glint.setAttribute('opacity', round(0.96 * (1 - squint * 0.5)));
      if (eye.joy) { eye.joy.setAttribute('opacity', round(joy)); eye.body.setAttribute('opacity', round(1 - joy)); }
    });
    face.blush.forEach(function (spot) { spot.setAttribute('opacity', round(0.95 * joy)); });
    face.brows.forEach(function (brow) {
      var side = Number(brow.getAttribute('data-brow')), index = side > 0 ? 1 : 0;
      var y = recipe.cy - face.b * k - 4.6 - Number(brow.getAttribute('data-lift')) + shut * 1.6 - squint * 1.6 - wide * 1.5 + gy * 1.1;
      brow.setAttribute('transform', 'translate(' + round(face.x[index] + gx * 1.5) + ' ' + round(y) + ')');
    });
  }

  /* ---------- Cuadro: gota (resorte) y lava ---------- */

  var RATES = { hover: 14, press: 30, active: 6, think: 5, done: 9, away: 4 };

  function ease(face, dt) {
    for (var key in RATES) face.now[key] += (face.goal[key] - face.now[key]) * (1 - Math.exp(-dt * RATES[key]));
  }

  function scaleGoal(face, t) {
    var v = face.now;
    return 1 + 0.06 * v.hover * (1 - v.press) - 0.075 * v.press + 0.03 * v.done - 0.03 * v.away + 0.016 * v.active * Math.sin(t * 1.85 + (face.seedInt % 9));
  }

  function springs(face, t, dt) {
    var pull = (scaleGoal(face, t) - face.scale) * 260 - face.scaleSpeed * 17;
    face.scaleSpeed += pull * dt; face.scale += face.scaleSpeed * dt;
    pull = (face.now.press - face.squish) * 300 - face.squishSpeed * 16;
    face.squishSpeed += pull * dt; face.squish += face.squishSpeed * dt;
    pull = -face.hop * 210 - face.hopSpeed * 13;
    face.hopSpeed += pull * dt; face.hop += face.hopSpeed * dt;
  }

  function drawDrop(face) {
    var next = 'translateY(' + round(face.hop) + 'px) scale(' + (Math.round(face.scale * (1 + 0.04 * face.squish) * 1000) / 1000) + ', ' + (Math.round(face.scale * (1 - 0.07 * face.squish) * 1000) / 1000) + ')';
    if (next !== face.drawn) { face.drawn = next; face.drop.style.transform = next; }
  }

  function lavaSpeed(face) {
    var v = face.now;
    return Math.max(0.12, 1 + 0.9 * v.hover + 1.5 * v.press + 0.45 * v.active + 1.5 * v.think + 0.6 * v.done - 0.85 * v.away);
  }

  function drawLight(time) {
    SHEETS.forEach(function (sheet) {
      if (!sheet.grid) return;
      var last = -1;
      for (var i = 0; i < sheet.slots.length; i += 1) if (sheet.slots[i]) { last = i; sheet.phases[i] = sheet.slots[i].phase; }
      if (last < 0) return;
      sheet.grid.render(time, sheet.phases, Math.floor(last / sheet.cols) + 1);
      faces.forEach(function (face) {
        if (face.sheet !== sheet || !face.context || !face.visible) return;
        var side = face.canvas.width, cell = sheet.cell;
        face.context.clearRect(0, 0, side, side);
        face.context.drawImage(sheet.grid.canvas, (face.slot % sheet.cols) * cell, Math.floor(face.slot / sheet.cols) * cell, cell, cell, 0, 0, side, side);
      });
    });
  }

  function settle(face) {
    for (var key in RATES) face.now[key] = face.goal[key];
    face.scale = scaleGoal(face, frozen || 0); face.scaleSpeed = 0;
    face.squish = face.now.press; face.squishSpeed = 0; face.hop = 0; face.hopSpeed = 0;
    drawDrop(face);
    drawEyes(face, frozen || 0, null);
  }

  /* ---------- Reloj ---------- */

  var pointer = null, started = false, frozen = null, measuring = false, frame = 0, last = 0;

  function reduced() { return Boolean(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function clock() { return frozen != null ? frozen : root.performance.now() / 1000; }

  function measure() {
    measuring = false;
    faces.forEach(function (face) {
      var box = face.node.getBoundingClientRect();
      face.cx = box.left + box.width / 2; face.cy = box.top + box.height / 2;
    });
  }
  function measureSoon() { if (!measuring) { measuring = true; root.requestAnimationFrame(measure); } }

  function loop(now) {
    if (frozen != null) return;
    var dt = Math.min(0.05, (now - last) / 1000), t = now / 1000;
    last = now; frame += 1;
    var follow = pointer && now - pointer.at < 4000;
    faces.forEach(function (face) {
      ease(face, dt);
      springs(face, t, dt);
      face.phase += dt * lavaSpeed(face);
      if (!face.visible) return;
      drawDrop(face);
      if (frame % 2) return;
      var want = 0;
      if (follow) { var dx = pointer.x - face.cx, dy = pointer.y - face.cy; want = Math.max(face.now.hover, 1 - smooth((Math.sqrt(dx * dx + dy * dy) - 120) / 700)); }
      face.near += (want - face.near) * (1 - Math.exp(-dt * 2 * 14));
      drawEyes(face, t, follow ? pointer : null);
    });
    drawLight(t);
    root.requestAnimationFrame(loop);
  }

  function start() {
    if (started || frozen != null) return;
    started = true;
    if (reduced()) { still(0); return; }
    root.addEventListener('pointermove', function (event) { pointer = { x: event.clientX, y: event.clientY, at: root.performance.now() }; }, { passive: true });
    document.documentElement.addEventListener('pointerleave', function () { pointer = null; });
    root.addEventListener('resize', measureSoon);
    root.addEventListener('scroll', measureSoon, { passive: true, capture: true });
    last = root.performance.now();
    root.requestAnimationFrame(loop);
  }

  // Deja todo quieto en el instante t: para capturas y para quien pide menos movimiento.
  function still(t) {
    frozen = typeof t === 'number' ? t : 0;
    started = true;
    measure();
    faces.forEach(function (face) { face.phase = frozen + face.light.offset; settle(face); });
    drawLight(frozen);
  }

  function group() { groupCount += 1; return { seed: hashText('grupo' + groupCount), faces: [] }; }

  root.RondaCaras = { mount: mount, group: group, still: still, recipeFor: recipeFor, keyFor: keyFor, lightFor: lightFor, levelFor: levelFor, STATES: STATES, TEAM: TEAM, TEAM_LIGHT: TEAM_LIGHT };
})(window);
