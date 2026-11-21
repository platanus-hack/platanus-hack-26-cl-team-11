/*
 * Ronda · caras de prueba para design/caras/sabores.html.
 * Tres sabores que se generan desde el nombre, sin imágenes: Tinta, Aura y Monograma.
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

  /* ---------- Tinta: la cara es el disco de vidrio, dibujada con la tinta del texto ---------- */

  var HAIR = {
    corto: 'M-5 -5H105V42C96 27 78 21 50 21C22 21 4 27 -5 42Z',
    lado: 'M-5 -5H105V46C98 32 84 26 66 28C53 29 43 28 33 21C25 30 9 37 -5 47Z',
    copete: 'M-5 -5H105V42C95 31 81 31 65 22C52 15 40 21 28 28C16 33 5 35 -5 44Z',
    flequillo: 'M-5 -5H105V105H88C91 84 89 62 84 46Q84 37 75 37H25Q16 37 16 46C11 62 9 84 12 105H-5Z',
    largo: 'M-5 -5H105V105H90C93 76 86 44 50 18C14 44 7 76 10 105H-5Z',
    melena: 'M-5 -5H105V105H87C91 78 90 54 80 38C66 35 50 30 38 17C26 34 13 50 12 105H-5Z',
    rizos: 'M-5 -5H105V30H-5Z'
  };
  var CURLS = [[8, 34], [26, 25], [44, 20], [62, 21], [80, 26], [96, 35]];
  var HAIR_TONE = { tinta: 1, grafito: 0.7, plata: 0.24 };

  var EYES = {
    punto: '<circle cx="36" cy="55" r="3.9"/><circle cx="64" cy="55" r="3.9"/>',
    ovalo: '<ellipse cx="36" cy="55" rx="3.5" ry="4.9"/><ellipse cx="64" cy="55" rx="3.5" ry="4.9"/>',
    feliz: '<path class="line" d="M30.5 56.5Q36 50 41.5 56.5"/><path class="line" d="M58.5 56.5Q64 50 69.5 56.5"/>'
  };
  var BROWS = {
    arco: '<path class="thin" d="M30.5 45.5Q36 42.5 41.5 45.5"/><path class="thin" d="M58.5 45.5Q64 42.5 69.5 45.5"/>',
    firme: '<path class="thin" d="M30.5 43.5L41.5 46.5"/><path class="thin" d="M69.5 43.5L58.5 46.5"/>',
    pillo: '<path class="thin" d="M30.5 43.5L41.5 46.5"/><path class="thin" d="M58.5 44.5Q64 41 69.5 44"/>'
  };
  var MOUTH = {
    sonrisa: '<path class="line" d="M41.5 68Q50 76 58.5 68"/>',
    chica: '<path class="line" d="M45 69.5Q50 73.5 55 69.5"/>',
    abierta: '<path d="M41.5 67.5Q50 79.5 58.5 67.5Z" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/>',
    lado: '<path class="line" d="M43 70.5Q52 74.5 58.5 66.5"/>',
    recta: '<path class="line" d="M44 70.5H56"/>'
  };
  var GLASSES = {
    redondo: '<circle cx="36" cy="55" r="10.2"/><circle cx="64" cy="55" r="10.2"/><path d="M46.2 54Q50 51.5 53.8 54M25.8 54L9 49.5M74.2 54L91 49.5"/>',
    recto: '<rect x="25.5" y="46.5" width="20.5" height="16" rx="5"/><rect x="54" y="46.5" width="20.5" height="16" rx="5"/><path d="M46 54H54M25.5 53L9 49.5M74.5 53L91 49.5"/>'
  };
  var BEARD = 'M-5 58C14 63 30 61 50 61C70 61 86 63 105 58V105H-5Z';

  function tintaRecipe(seed) {
    var random = randomFrom('tinta:' + seed);
    var recipe = {
      hair: pickWeighted(random, [['corto', 22], ['lado', 18], ['copete', 12], ['flequillo', 12], ['largo', 13], ['melena', 11], ['rizos', 8], [null, 4]]),
      tone: pickWeighted(random, [['tinta', 58], ['grafito', 28], ['plata', 14]]),
      flip: random() < 0.5,
      eyes: pickWeighted(random, [['punto', 62], ['ovalo', 20], ['feliz', 18]]),
      brows: pickWeighted(random, [[null, 46], ['arco', 30], ['firme', 16], ['pillo', 8]]),
      mouth: pickWeighted(random, [['sonrisa', 40], ['chica', 26], ['abierta', 12], ['lado', 14], ['recta', 8]]),
      glasses: pickWeighted(random, [[null, 74], ['redondo', 16], ['recto', 10]]),
      beard: random() < 0.14
    };
    if (recipe.beard && (recipe.hair === 'flequillo' || recipe.hair === 'largo' || recipe.hair === 'melena')) recipe.beard = false;
    return recipe;
  }

  function tinta(seed, options) {
    var settings = options || {};
    var recipe = settings.recipe || tintaRecipe(seed);
    var small = Boolean(settings.small);
    var parts = [];

    if (recipe.beard) parts.push('<path d="' + BEARD + '" opacity="0.13"/>');

    if (recipe.hair) {
      var hair = '<path d="' + HAIR[recipe.hair] + '"/>';
      if (recipe.hair === 'rizos') hair += CURLS.map(function (curl) { return '<circle cx="' + curl[0] + '" cy="' + curl[1] + '" r="12.5"/>'; }).join('');
      parts.push('<g opacity="' + (HAIR_TONE[recipe.tone] || 1) + '"' + (recipe.flip ? ' transform="translate(100 0) scale(-1 1)"' : '') + '>' + hair + '</g>');
      parts.push('<ellipse cx="32" cy="13" rx="25" ry="5.5" transform="rotate(-24 32 13)" fill="#fff" opacity="0.1"/>');
    }

    if (small) {
      parts.push('<circle cx="35" cy="57" r="6.4"/><circle cx="65" cy="57" r="6.4"/>');
    } else {
      if (recipe.glasses) parts.push('<g fill="#fff" fill-opacity="0.42" stroke="currentColor" stroke-width="2.7" stroke-linecap="round">' + GLASSES[recipe.glasses] + '</g>');
      parts.push(EYES[recipe.eyes] || EYES.punto);
      if (recipe.brows && recipe.glasses !== 'recto') parts.push(BROWS[recipe.brows]);
      parts.push(MOUTH[recipe.mouth] || MOUTH.sonrisa);
    }

    return '<svg viewBox="0 0 100 100" aria-hidden="true" fill="currentColor"><style>.line{fill:none;stroke:currentColor;stroke-width:3.3;stroke-linecap:round}.thin{fill:none;stroke:currentColor;stroke-width:2.5;stroke-linecap:round}</style>' + parts.join('') + '</svg>';
  }

  /* ---------- Aura: una gota de luz por persona, con su mezcla de los cuatro colores del aura ---------- */

  var AURA = ['79, 180, 255', '179, 107, 255', '255, 95, 168', '255, 162, 74'];

  function aura(seed) {
    var random = randomFrom('aura:' + seed);
    var colors = AURA.slice().sort(function () { return random() - 0.5; });
    var turn = random() * Math.PI * 2;
    var layers = ['radial-gradient(circle at 31% 24%, rgba(255, 255, 255, 0.95) 0, rgba(255, 255, 255, 0) 36%)'];
    for (var i = 0; i < 3; i += 1) {
      var angle = turn + i * (Math.PI * 2 / 3) + (random() - 0.5) * 0.9;
      var reach = 26 + random() * 16;
      var x = (50 + Math.cos(angle) * reach).toFixed(1);
      var y = (50 + Math.sin(angle) * reach).toFixed(1);
      layers.push('radial-gradient(circle at ' + x + '% ' + y + '%, rgba(' + colors[i] + ', ' + (0.95 - i * 0.06).toFixed(2) + ') 0, rgba(' + colors[i] + ', 0) ' + (64 - i * 3) + '%)');
    }
    layers.push('#f3f2fc');
    return layers.join(', ');
  }

  /* ---------- Monograma: iniciales sobre vidrio, como Contactos de Apple sin foto ---------- */

  function monograma(name, surname) {
    var first = (name || '?').trim().charAt(0).toUpperCase();
    var second = surname ? surname.trim().charAt(0).toUpperCase() : '';
    return first + second;
  }

  root.RondaCaras = { tinta: tinta, tintaRecipe: tintaRecipe, aura: aura, monograma: monograma, randomFrom: randomFrom };
})(window);
