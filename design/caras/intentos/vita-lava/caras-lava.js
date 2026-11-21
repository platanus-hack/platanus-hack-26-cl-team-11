/*
 * Montu · «Vita de lava». La persona es una gota de lava y lleva el dibujo de Vita Faces encima.
 *
 * La luz (RondaLuz.grid) llena toda la gota. Sobre ella van, dibujados por el equipo de Vita Faces: pelo, cejas, ojos,
 * boca y anteojos, en tinta, con un halo claro muy fino para que se lean sobre cualquier masa de color.
 *
 *   var face = RondaCarasLava.create('Camila');                       // { el, canvas } redondo
 *   RondaCarasLava.fit(face);                                       // ajusta la resolución al tamaño en pantalla
 *   RondaCarasLava.paint(face, luzCanvas, sx, sy, sw, segundos);    // sx, sy, sw: la celda de luz; segundos mueve el parpadeo
 * Todo sale de un texto (la semilla), así que 5 o 300 personas dan siempre lo mismo.
 */
(function (root) {
  'use strict';

  /*ATLAS:begin*/
  var ATLAS = {"z":2,"hair":{"box":[20,62,236,212],"cell":[432,300],"at":{"short__black":[0,0],"short__darkbrown":[432,0],"short__brown":[864,0],"swept__black":[1296,0],"swept__darkbrown":[1728,0],"swept__brown":[0,300],"fringe__black":[432,300],"fringe__darkbrown":[864,300],"fringe__brown":[1296,300],"bob__black":[1728,300],"bob__darkbrown":[0,600],"bob__brown":[432,600],"long__black":[864,600],"long__darkbrown":[1296,600],"long__brown":[1728,600]}},"feat":{"box":[78,116,178,196],"cell":[200,160],"at":{"smile":[0,900],"smile__b":[200,900],"happy":[400,900],"happy__b":[600,900],"warm":[800,900],"warm__b":[1000,900],"content":[0,1060],"content__b":[200,1060],"serene":[400,1060],"serene__b":[600,1060],"wink":[800,1060],"wink__b":[1000,1060],"smirk":[0,1220],"smirk__b":[200,1220],"shy":[400,1220],"shy__b":[600,1220],"focused":[800,1220],"focused__b":[1000,1220]}},"gl":{"box":[66,128,190,182],"cell":[248,108],"at":{"round":[0,1380],"oval":[248,1380],"rect":[496,1380],"thick":[744,1380],"cateye":[992,1380]}},"head":{"box":[30,76,226,216],"cell":[392,280],"at":{"mask":[0,1488]}}};
  /*ATLAS:end*/

  var HEAD_CX = 127, HEAD_CY = 148, HEAD_W = 170;

  function randomFrom(seed) {
    var state = 0x811c9dc5;
    for (var i = 0; i < seed.length; i += 1) { state ^= seed.charCodeAt(i); state = Math.imul(state, 0x01000193); }
    state = state >>> 0 || 0x9e3779b9;
    return function () { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 0x100000000; };
  }
  function pick(random, options) { return options[Math.floor(random() * options.length)]; }
  function weighted(random, options) {
    var total = options.reduce(function (sum, option) { return sum + option[1]; }, 0);
    var roll = random() * total;
    for (var i = 0; i < options.length; i += 1) { roll -= options[i][1]; if (roll < 0) return options[i][0]; }
    return options[options.length - 1][0];
  }

  var TEAM = {
    mati: { face: 'smirk', hair: 'short', color: 'black', blink: 0.12 },
    ian: { face: 'happy', hair: 'swept', color: 'brown', blink: 0.47 },
    lian: { face: 'warm', hair: 'fringe', color: 'black', glasses: 'round', blink: 0.81 },
    andres: { face: 'content', hair: 'short', color: 'darkbrown', flip: true, blink: 0.33 },
    roberto: { face: 'smile', hair: 'swept', color: 'black', blink: 0.64 }
  };
  var TEAM_LIGHT = { mati: [0, 9, 8, 1], ian: [5, 7, 4, 6], lian: [9, 8, 7, 10], andres: [2, 1, 3, 0], roberto: [6, 5, 8, 7] };

  function recipeFor(seed) {
    var random = randomFrom('lava-cara:' + seed);
    var recipe = { face: weighted(random, [['smile', 24], ['warm', 16], ['content', 14], ['happy', 12], ['serene', 10], ['smirk', 8], ['wink', 6], ['focused', 6], ['shy', 4]]) };
    var hair = weighted(random, [['short', 24], ['swept', 22], ['bob', 14], ['fringe', 12], ['long', 8], [null, 6]]);
    if (hair) {
      recipe.hair = hair;
      recipe.color = weighted(random, [['black', 42], ['darkbrown', 36], ['brown', 22]]);
      recipe.flip = random() < 0.5;
    }
    if (random() < 0.26) recipe.glasses = pick(random, ['round', 'oval', 'rect', 'thick', 'cateye']);
    recipe.blink = random();
    return recipe;
  }

  var base = (function () {
    var script = root.document && root.document.currentScript;
    return script && script.src ? script.src.replace(/[^\/]*$/, '') : '';
  })();
  var atlas = new root.Image();
  var ready = false, waiting = [];
  atlas.onload = function () { ready = true; waiting.splice(0).forEach(function (callback) { callback(); }); };
  atlas.src = base + 'partes.webp';
  function whenReady(callback) { if (ready) callback(); else waiting.push(callback); }

  function canvasOf(px) {
    var canvas = root.document.createElement('canvas');
    canvas.width = canvas.height = px;
    return canvas;
  }

  function create(seed) {
    var recipe = typeof seed === 'object' ? seed : (TEAM[seed] || recipeFor(seed));
    var element = root.document.createElement('span');
    element.className = 'cv';
    var canvas = root.document.createElement('canvas');
    element.appendChild(canvas);
    return { el: element, canvas: canvas, recipe: recipe, ready: false, px: 0 };
  }

  function fit(face, size) {
    var scale = Math.min(2, root.devicePixelRatio || 1);
    var px = Math.max(8, Math.round((size || face.el.clientWidth || 64) * scale));
    if (px === face.px) return;
    face.px = px;
    face.canvas.width = face.canvas.height = px;
    face.ready = false;
  }

  // Dibuja una pieza del atlas: su recuadro está en unidades de 256 px de la cara de Vita; k pasa esas unidades a píxeles.
  function part(context, group, key, geometry, flip) {
    var set = ATLAS[group], at = set.at[key], box = set.box;
    var x = (box[0] - HEAD_CX) * geometry.k + geometry.cx, y = (box[1] - geometry.hy) * geometry.k + geometry.cy;
    var w = (box[2] - box[0]) * geometry.k, h = (box[3] - box[1]) * geometry.k;
    if (flip) {
      context.save();
      context.translate(geometry.cx * 2, 0);
      context.scale(-1, 1);
    }
    context.drawImage(atlas, at[0], at[1], set.cell[0], set.cell[1], x, y, w, h);
    if (flip) context.restore();
  }

  function halo(source, px, strength) {
    var out = canvasOf(px), context = out.getContext('2d');
    context.shadowColor = 'rgba(255, 255, 255, ' + strength + ')';
    context.shadowBlur = Math.max(2, px * 0.028);
    context.shadowOffsetX = px * 3;
    context.drawImage(source, -px * 3, 0);
    context.drawImage(source, -px * 3, 0);
    return out;
  }

  function compose(face) {
    var px = face.px, recipe = face.recipe, fine = px >= 48, mid = px >= 30;
    var k = px * 1.06 / HEAD_W;
    var geometry = { k: k, cx: px / 2, cy: px * 0.5, hy: HEAD_CY };
    var featScale = fine ? 1.0 : 1.28;
    var featGeometry = { k: k * featScale, cx: px / 2, cy: geometry.cy + px * 0.045, hy: 156 };
    face.hair = canvasOf(px);
    if (recipe.hair) part(face.hair.getContext('2d'), 'hair', recipe.hair + '__' + recipe.color, geometry, recipe.flip);
    face.feat = canvasOf(px);
    part(face.feat.getContext('2d'), 'feat', recipe.face + (fine ? '' : '__b'), featGeometry);
    face.glass = canvasOf(px);
    if (recipe.glasses && mid) part(face.glass.getContext('2d'), 'gl', recipe.glasses, { k: k * featScale, cx: px / 2, cy: featGeometry.cy + px * 0.006, hy: 156 });
    var union = canvasOf(px), u = union.getContext('2d');
    u.drawImage(face.hair, 0, 0); u.drawImage(face.feat, 0, 0); u.drawImage(face.glass, 0, 0);
    face.halo = halo(union, px, fine ? 0.5 : 0.7);
    var gloss = face.hair.getContext('2d');
    gloss.globalCompositeOperation = 'source-atop';
    var shine = gloss.createLinearGradient(0, px * 0.05, 0, px * 0.5);
    shine.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
    shine.addColorStop(1, 'rgba(255, 255, 255, 0)');
    gloss.fillStyle = shine;
    gloss.fillRect(0, 0, px, px);
    face.eyeY = featGeometry.cy + (140 - 156) * featGeometry.k;
    face.period = 4.6 + recipe.blink * 3;
    face.phase = recipe.blink * 17;
    face.sheen = canvasOf(px);
    var sheen = face.sheen.getContext('2d');
    var glint = sheen.createRadialGradient(px * 0.3, px * 0.2, 0, px * 0.3, px * 0.2, px * 0.36);
    glint.addColorStop(0, 'rgba(255, 255, 255, 0.34)');
    glint.addColorStop(1, 'rgba(255, 255, 255, 0)');
    sheen.fillStyle = glint;
    sheen.fillRect(0, 0, px, px);
    sheen.globalCompositeOperation = 'destination-in';
    sheen.beginPath(); sheen.arc(px / 2, px / 2, px / 2, 0, Math.PI * 2); sheen.fill();
    face.ready = true;
  }

  function blink(face, seconds) {
    if (seconds == null) return 1;
    var phase = (seconds + face.phase) % face.period;
    if (phase > 0.16) return 1;
    return 1 - 0.92 * Math.sin(Math.PI * phase / 0.16);
  }

  function paint(face, light, sx, sy, sw, seconds) {
    if (!ready) return;
    var px = face.px, context = face.canvas.getContext('2d');
    if (!face.ready) compose(face);
    context.globalCompositeOperation = 'source-over';
    context.clearRect(0, 0, px, px);
    context.drawImage(light, sx, sy, sw, sw, 0, 0, px, px);
    context.drawImage(face.halo, 0, 0);
    context.drawImage(face.hair, 0, 0);
    var open = blink(face, seconds);
    if (open < 1) {
      context.save();
      context.translate(0, face.eyeY);
      context.scale(1, open);
      context.translate(0, -face.eyeY);
      context.drawImage(face.feat, 0, 0);
      context.restore();
    } else context.drawImage(face.feat, 0, 0);
    context.drawImage(face.glass, 0, 0);
    context.drawImage(face.sheen, 0, 0);
  }

  root.RondaCarasLava = { create: create, fit: fit, paint: paint, whenReady: whenReady, recipeFor: recipeFor, TEAM: TEAM, TEAM_LIGHT: TEAM_LIGHT };
})(window);
