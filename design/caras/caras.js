/*
 * Ronda · caras de prueba para design/caras/sabores.html.
 * Un solo dibujo de cara (pelo, ojos, boca) que se usa de dos maneras:
 *   Tinta  la cara sobre un disco de vidrio blanco
 *   Aura   la misma cara sobre una gota de luz fluida (design/luz/luz.js); el pelo deja pasar algo de su color
 * Propuesta del 21-nov-2026. Nada de esto está en el producto.
 */
(function (root) {
  'use strict';

  function randomFrom(seed) {
    var state = 0x811c9dc5;
    for (var i = 0; i < seed.length; i += 1) {
      state ^= seed.charCodeAt(i);
      state = Math.imul(state, 0x01000193);
    }
    state = state >>> 0 || 0x9e3779b9;
    return function () {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return (state >>> 0) / 0x100000000;
    };
  }

  function pickWeighted(random, options) {
    var total = options.reduce(function (sum, option) { return sum + option[1]; }, 0);
    var roll = random() * total;
    for (var i = 0; i < options.length; i += 1) {
      roll -= options[i][1];
      if (roll < 0) return options[i][0];
    }
    return options[options.length - 1][0];
  }

  // El disco es la cabeza (100 x 100, recortado en círculo). El pelo baja más en las sienes que en la frente.
  var HAIR = {
    corto: 'M-6 -6H106V47C100 34 91 26 76 23.5C62 21 48 22.5 36 26C21 30.5 5 36 -6 49Z',
    lado: 'M-6 -6H106V50C101 38 93 31 82 28C68 31 50 30 38 23C34 21 31 20.5 28 22C20 28 8 38 -6 52Z',
    ondas: 'M-6 -6H106V46C99 36 92 30 82 30C74 30 70 24 60 24C50 24 48 30 38 30C28 30 24 26 16 30C8 34 0 40 -6 48Z',
    flequillo: 'M-6 -6H106V106H90C92 86 91 66 87 50C86 41 81 37.5 72 36.5Q50 33.5 28 36.5C19 37.5 14 41 13 50C9 66 8 86 10 106H-6Z',
    largo: 'M-6 -6H106V106H91C93 88 93 70 91 54C89 40 78 30 64 26C58 24.5 53 23 50 20.5C47 23 42 24.5 36 26C22 30 11 40 9 54C7 70 7 88 9 106H-6Z',
    melena: 'M-6 -6H106V106H90C93 86 93 66 90 52C86 40 76 33 62 30C52 28 43 25 36 19C27 28 14 38 11 54C8 70 8 88 10 106H-6Z',
    rizos: 'M-6 -6H106V27H-6Z'
  };
  var CURLS = [[6, 38], [20, 28.5], [36, 23], [52, 21.5], [68, 24], [83, 30.5], [96, 40]];
  var HAIR_TONE = { tinta: 0.93, grafito: 0.62, plata: 0.3, rapado: 0.2 };

  var EYES = {
    punto: '<circle cx="37" cy="57" r="3.5"/><circle cx="63" cy="57" r="3.5"/>',
    ovalo: '<ellipse cx="37" cy="57" rx="3.1" ry="4.3"/><ellipse cx="63" cy="57" rx="3.1" ry="4.3"/>',
    feliz: '<path class="line" d="M32 58.5Q37 53 42 58.5"/><path class="line" d="M58 58.5Q63 53 68 58.5"/>'
  };
  var BROWS = '<path class="thin" d="M32.5 48.5Q37 46.2 41.5 48.5"/><path class="thin" d="M58.5 48.5Q63 46.2 67.5 48.5"/>';
  var MOUTH = {
    sonrisa: '<path class="line" d="M43.5 68.5Q50 74.5 56.5 68.5"/>',
    chica: '<path class="line" d="M46 69.5Q50 72.8 54 69.5"/>',
    serena: '<path class="line" d="M45 70.2Q50 71.6 55 70.2"/>'
  };
  var GLASSES = {
    redondo: '<circle cx="37" cy="57" r="9.4"/><circle cx="63" cy="57" r="9.4"/><path d="M46.4 56Q50 53.8 53.6 56M27.6 56L10 51.5M72.4 56L90 51.5"/>',
    recto: '<rect x="27" y="49" width="19.5" height="15" rx="5"/><rect x="53.5" y="49" width="19.5" height="15" rx="5"/><path d="M46.5 56H53.5M27 55.5L10 51.5M73 55.5L90 51.5"/>'
  };
  var BEARD = 'M-6 60C14 65 30 63 50 63C70 63 86 65 106 60V106H-6Z';
  var STYLE = '<style>.line{fill:none;stroke:currentColor;stroke-width:2.9;stroke-linecap:round}.thin{fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round}</style>';

  function recipeFor(seed) {
    var random = randomFrom('cara:' + seed);
    var recipe = {
      hair: pickWeighted(random, [['corto', 22], ['lado', 16], ['ondas', 12], ['flequillo', 12], ['largo', 13], ['melena', 11], ['rizos', 9], [null, 5]]),
      tone: pickWeighted(random, [['tinta', 52], ['grafito', 30], ['plata', 14], ['rapado', 4]]),
      flip: random() < 0.5,
      eyes: pickWeighted(random, [['punto', 60], ['ovalo', 22], ['feliz', 18]]),
      brows: random() < 0.22,
      mouth: pickWeighted(random, [['sonrisa', 48], ['chica', 34], ['serena', 18]]),
      glasses: pickWeighted(random, [[null, 76], ['redondo', 15], ['recto', 9]]),
      beard: random() < 0.12
    };
    if (recipe.beard && (recipe.hair === 'flequillo' || recipe.hair === 'largo' || recipe.hair === 'melena')) recipe.beard = false;
    if (recipe.glasses && recipe.eyes === 'feliz') recipe.eyes = 'punto';
    if (recipe.tone === 'rapado' && recipe.hair !== 'corto') recipe.tone = 'tinta';
    return recipe;
  }

  // Devuelve solo el dibujo, sin fondo: quien llama pone debajo el vidrio o la luz.
  function rostro(seed, options) {
    var settings = options || {};
    var recipe = settings.recipe || recipeFor(seed);
    var parts = [];

    if (recipe.beard) parts.push('<path d="' + BEARD + '" opacity="0.16"/>');

    if (recipe.hair) {
      var hair = '<path d="' + HAIR[recipe.hair] + '"/>';
      if (recipe.hair === 'rizos') hair += CURLS.map(function (curl) { return '<circle cx="' + curl[0] + '" cy="' + curl[1] + '" r="10.8"/>'; }).join('');
      parts.push('<g opacity="' + (HAIR_TONE[recipe.tone] || HAIR_TONE.tinta) + '"' + (recipe.flip ? ' transform="translate(100 0) scale(-1 1)"' : '') + '>' + hair + '</g>');
    }

    if (settings.small) {
      parts.push('<circle cx="36" cy="58" r="6"/><circle cx="64" cy="58" r="6"/>');
    } else {
      if (recipe.glasses) parts.push('<g fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round">' + GLASSES[recipe.glasses] + '</g>');
      parts.push(EYES[recipe.eyes] || EYES.punto);
      if (recipe.brows && !recipe.glasses) parts.push(BROWS);
      parts.push(MOUTH[recipe.mouth] || MOUTH.sonrisa);
    }

    return '<svg viewBox="0 0 100 100" aria-hidden="true" fill="currentColor">' + STYLE + parts.join('') + '</svg>';
  }

  // Las cinco del equipo, en el orden de las imágenes de design/faces/.
  var TEAM = {
    mati: { hair: 'corto', tone: 'tinta', eyes: 'punto', mouth: 'sonrisa', brows: true },
    ian: { hair: 'ondas', tone: 'grafito', eyes: 'feliz', mouth: 'sonrisa' },
    lian: { hair: 'flequillo', tone: 'tinta', eyes: 'punto', mouth: 'chica', glasses: 'redondo' },
    roberto: { hair: 'corto', tone: 'tinta', flip: true, eyes: 'ovalo', mouth: 'chica' },
    andres: { hair: 'lado', tone: 'grafito', eyes: 'ovalo', mouth: 'sonrisa' }
  };
  // Tonos de la rueda de design/luz/luz.js para la gota de cada integrante.
  var TEAM_LIGHT = { mati: [0, 9, 8, 1], ian: [5, 7, 4, 6], lian: [9, 8, 7, 10], roberto: [6, 5, 8, 7], andres: [2, 1, 3, 0] };

  function monograma(name, surname) {
    var first = (name || '?').trim().charAt(0).toUpperCase();
    var second = surname ? surname.trim().charAt(0).toUpperCase() : '';
    return first + second;
  }

  root.RondaCaras = { rostro: rostro, recipeFor: recipeFor, monograma: monograma, randomFrom: randomFrom, TEAM: TEAM, TEAM_LIGHT: TEAM_LIGHT };
})(window);
