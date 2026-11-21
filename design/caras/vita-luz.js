/*
 * Ronda · «Vita Faces de luz». Una persona hecha de luz.
 *
 * Mismas piezas que las Vita Faces (cara, pelo, ropa, lentes), pero la cabeza no tiene color propio: es la luz
 * fluida de la persona, recortada con la silueta de la cabeza y con su volumen encima (sombra y brillo de vidrio).
 * Rasgos, pelo y ropa se dibujan sobre ella en tinta tranquila, así que se leen sobre cualquier mancha de luz.
 *
 * Contrato con la página: cada cara es un círculo con UN <canvas> que esta librería pinta. La página sólo
 * entrega la luz (un canvas con la gota de esa persona, por ejemplo una celda de RondaLuz.grid):
 *   var face = RondaCarasLuz.create('Camila');          // elemento redondo con su canvas
 *   RondaCarasLuz.fit(face);                            // ajusta la resolución al tamaño en pantalla
 *   RondaCarasLuz.paint(face, luzCanvas, sx, sy, sw);   // sx, sy, sw: el cuadrado de luz que le toca
 * Modo 'orbe': la luz llena el círculo y el personaje (con cabeza propia) va delante.
 * Modo 'cabeza' (por defecto): la luz es la cabeza, sobre un vidrio tranquilo.
 * Todo sale de un texto (la semilla), así que 5 o 300 personas dan siempre lo mismo.
 */
(function (root) {
  'use strict';

  /*ATLAS:begin*/
  var ATLAS = {"tile":256,"cols":8,"rows":8,"head":{"x0":31,"y0":75,"x1":222,"y1":211},"index":{"head":{"shade":0,"glow":1},"skin":{"white":2,"cream":3,"yellow":4},"features":{"smile":5,"open":6,"happy":7,"warm":8,"content":9,"serene":10,"wink":11,"smirk":12,"focused":13,"determined":14,"shy":15},"hair":{"short__black":16,"short__darkbrown":17,"short__brown":18,"short__grey":19,"swept__black":20,"swept__darkbrown":21,"swept__brown":22,"swept__grey":23,"bob__black":24,"bob__darkbrown":25,"bob__brown":26,"bob__grey":27,"fringe__black":28,"fringe__darkbrown":29,"fringe__brown":30,"fringe__grey":31,"long__black":32,"long__darkbrown":33,"long__brown":34,"long__grey":35,"ponytail__black":36,"ponytail__darkbrown":37,"ponytail__brown":38,"ponytail__grey":39,"bun__black":40,"bun__darkbrown":41,"bun__brown":42,"bun__grey":43},"top":{"grey":44,"charcoal":45,"navy":46,"offwhite":47,"olive":48,"sage":49,"camel":50,"skyblue":51},"glasses":{"round":52,"oval":53,"rect":54,"thick":55,"cateye":56},"accessory":{"collar":57,"scarf":58,"headphones":59}}};
  /*ATLAS:end*/

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

  function pick(random, options) { return options[Math.floor(random() * options.length)]; }

  function weighted(random, options) {
    var total = options.reduce(function (sum, option) { return sum + option[1]; }, 0);
    var roll = random() * total;
    for (var i = 0; i < options.length; i += 1) {
      roll -= options[i][1];
      if (roll < 0) return options[i][0];
    }
    return options[options.length - 1][0];
  }

  // Cinco del equipo, a mano. El resto sale de la semilla.
  var TEAM = {
    mati: { skin: 'cream', face: 'smirk', top: 'charcoal', hair: 'short', hairColor: 'black' },
    ian: { skin: 'white', face: 'happy', top: 'navy', hair: 'swept', hairColor: 'brown' },
    lian: { skin: 'yellow', face: 'focused', top: 'olive', hair: 'fringe', hairColor: 'black', glasses: 'round' },
    andres: { skin: 'white', face: 'warm', top: 'camel', hair: 'short', hairColor: 'darkbrown' },
    roberto: { skin: 'cream', face: 'smile', top: 'sage', hair: 'swept', hairColor: 'black', accessory: 'collar' }
  };
  // Cada persona toma cuatro tonos de la rueda de luz.js; los del equipo se reparten por toda la rueda.
  var TEAM_LIGHT = { mati: [0, 9, 8, 1], ian: [5, 7, 4, 6], lian: [9, 8, 7, 10], andres: [2, 1, 3, 0], roberto: [6, 5, 8, 7] };

  function recipeFor(seed) {
    var random = randomFrom('luz-cara:' + seed);
    var recipe = {
      skin: pick(random, ['white', 'cream', 'yellow']),
      face: weighted(random, [['smile', 20], ['warm', 14], ['content', 12], ['happy', 10], ['serene', 10], ['open', 8], ['smirk', 8], ['wink', 6], ['focused', 7], ['determined', 3], ['shy', 5]]),
      top: pick(random, ['grey', 'charcoal', 'navy', 'offwhite', 'olive', 'sage', 'camel', 'skyblue'])
    };
    var hair = weighted(random, [['short', 22], ['swept', 20], ['bob', 12], ['fringe', 10], ['long', 14], ['ponytail', 10], ['bun', 8], [null, 4]]);
    if (hair) { recipe.hair = hair; recipe.hairColor = weighted(random, [['black', 38], ['darkbrown', 34], ['brown', 22], ['grey', 6]]); }
    if (random() < 0.26) recipe.glasses = pick(random, ['round', 'oval', 'rect', 'thick', 'cateye']);
    if (random() < 0.14) recipe.accessory = pick(random, ['collar', 'scarf', 'headphones']);
    return recipe;
  }

  var base = (function () {
    var script = root.document && root.document.currentScript;
    return script && script.src ? script.src.replace(/[^\/]*$/, '') : '';
  })();
  var atlas = new root.Image();
  var ready = false;
  var waiting = [];
  atlas.onload = function () { ready = true; waiting.splice(0).forEach(function (callback) { callback(); }); };
  atlas.src = base + 'partes.webp';

  function whenReady(callback) { if (ready) callback(); else waiting.push(callback); }

  function tile(group, key) {
    var position = ATLAS.index[group][key];
    return { x: (position % ATLAS.cols) * ATLAS.tile, y: Math.floor(position / ATLAS.cols) * ATLAS.tile };
  }

  function stamp(context, group, key, size) {
    var piece = tile(group, key);
    context.drawImage(atlas, piece.x, piece.y, ATLAS.tile, ATLAS.tile, 0, 0, size, size);
  }

  // Lo que va delante de la cabeza, en el orden de las Vita Faces, en tres capas: rasgos y pelo (en tinta), ropa (que recibe un
  // reflejo de la luz de la persona) y lo que va sobre la ropa. Con poco tamaño se sueltan los detalles finos.
  function layersFor(recipe, size) {
    var fine = size >= 30;
    var pre = [['features', recipe.face]];
    if (recipe.hair) pre.push(['hair', recipe.hair + '__' + recipe.hairColor]);
    var body = [['top', recipe.top]];
    if (fine && recipe.accessory && recipe.accessory !== 'headphones') body.push(['accessory', recipe.accessory]);
    var post = [];
    if (fine && recipe.glasses) post.push(['glasses', recipe.glasses]);
    if (fine && recipe.accessory === 'headphones') post.push(['accessory', 'headphones']);
    return { pre: pre, body: body, post: post };
  }

  function create(seed, options) {
    var settings = options || {};
    var recipe = typeof seed === 'object' ? seed : (settings.recipe || TEAM[seed] || recipeFor(seed));
    var element = root.document.createElement('span');
    element.className = 'cv cv--' + (settings.mode || 'cabeza');
    var canvas = root.document.createElement('canvas');
    element.appendChild(canvas);
    return { el: element, canvas: canvas, recipe: recipe, mode: settings.mode || 'cabeza', ready: false, px: 0 };
  }

  function fit(face, size) {
    var scale = Math.min(2, root.devicePixelRatio || 1);
    var px = Math.max(8, Math.round((size || face.el.clientWidth || 64) * scale));
    if (px === face.px) return;
    face.px = px;
    face.canvas.width = face.canvas.height = px;
    face.ready = false;
  }

  // Tinta de la cara y del pelo: negro con un dejo índigo, para que no parezca una calcomanía sobre la luz.
  var INK = 'rgba(52, 40, 96, 0.36)';

  function tinted(context, group, key, px) {
    var scratch = root.document.createElement('canvas');
    scratch.width = scratch.height = px;
    var inner = scratch.getContext('2d');
    stamp(inner, group, key, px);
    inner.globalCompositeOperation = 'source-atop';
    inner.fillStyle = INK;
    inner.fillRect(0, 0, px, px);
    context.drawImage(scratch, 0, 0);
  }

  function layer(px, list, face) {
    var canvas = root.document.createElement('canvas');
    canvas.width = canvas.height = px;
    var context = canvas.getContext('2d');
    list.forEach(function (item) {
      if (item[0] === 'features' || item[0] === 'hair') tinted(context, item[0], item[1], px);
      else stamp(context, item[0], item[1], px);
    });
    return canvas;
  }

  function compose(face) {
    var px = face.px, layers = layersFor(face.recipe, px);
    var box = ATLAS.head, scale = px / ATLAS.tile;
    face.pre = layer(px, layers.pre);
    face.body = layer(px, layers.body);
    face.post = layer(px, layers.post);
    var shadow = face.body.getContext('2d');
    var cx = (box.x0 + box.x1) / 2 * scale, cy = box.y1 * scale - px * 0.012, radius = (box.x1 - box.x0) * scale * 0.36;
    shadow.save();
    shadow.globalCompositeOperation = 'source-atop';
    shadow.translate(cx, cy);
    shadow.scale(1, 0.34);
    var fall = shadow.createRadialGradient(0, 0, 0, 0, 0, radius);
    fall.addColorStop(0, 'rgba(40, 30, 80, 0.30)');
    fall.addColorStop(1, 'rgba(40, 30, 80, 0)');
    shadow.fillStyle = fall;
    shadow.fillRect(-radius, -radius, radius * 2, radius * 2);
    shadow.restore();
    face.skin = face.mode === 'orbe' ? layer(px, [['skin', face.recipe.skin]]) : null;
    face.work = root.document.createElement('canvas');
    face.work.width = face.work.height = px;
    face.wash = root.document.createElement('canvas');
    face.wash.width = face.wash.height = px;
    face.ready = true;
  }

  // sx, sy, sw: el cuadrado de la luz (en píxeles del canvas de luz) que le toca a esta persona.
  function paint(face, light, sx, sy, sw) {
    if (!ready) return;
    var px = face.px, context = face.canvas.getContext('2d');
    if (!face.ready) compose(face);
    context.globalCompositeOperation = 'source-over';
    context.clearRect(0, 0, px, px);
    if (face.mode === 'orbe') {
      context.drawImage(light, sx, sy, sw, sw, 0, 0, px, px);
      context.drawImage(face.skin, 0, 0);
      context.drawImage(face.pre, 0, 0);
      context.drawImage(face.body, 0, 0);
      context.drawImage(face.post, 0, 0);
      return;
    }
    var box = ATLAS.head;
    var scale = px / ATLAS.tile;
    var headW = (box.x1 - box.x0) * scale, headH = (box.y1 - box.y0) * scale;
    var cropW = sw * 0.76, cropH = cropW * headH / headW;
    var work = face.work.getContext('2d');
    work.globalCompositeOperation = 'source-over';
    work.clearRect(0, 0, px, px);
    work.drawImage(light, sx + (sw - cropW) / 2, sy + (sw - cropH) / 2, cropW, cropH, box.x0 * scale, box.y0 * scale, headW, headH);
    work.globalCompositeOperation = 'destination-in';
    stamp(work, 'head', 'shade', px);
    work.globalCompositeOperation = 'multiply';
    stamp(work, 'head', 'shade', px);
    work.globalCompositeOperation = 'source-over';
    stamp(work, 'head', 'glow', px);
    var fine = px >= 36;
    if (fine) {
      // Halo: la misma luz, muy suave, se derrama de la cabeza al vidrio.
      var cx = (box.x0 + box.x1) / 2 * scale, cy = (box.y0 + box.y1) / 2 * scale + headH * 0.1;
      context.drawImage(light, sx, sy, sw, sw, 0, 0, px, px);
      context.globalCompositeOperation = 'destination-in';
      var fade = context.createRadialGradient(cx, cy, headW * 0.18, cx, cy, headW * 0.78);
      fade.addColorStop(0, 'rgba(0,0,0,0.5)');
      fade.addColorStop(1, 'rgba(0,0,0,0)');
      context.fillStyle = fade;
      context.fillRect(0, 0, px, px);
      context.globalCompositeOperation = 'source-over';
    }
    context.drawImage(face.work, 0, 0);
    context.drawImage(face.pre, 0, 0);
    if (fine) {
      var wash = face.wash.getContext('2d');
      wash.globalCompositeOperation = 'source-over';
      wash.clearRect(0, 0, px, px);
      wash.drawImage(face.body, 0, 0);
      wash.globalCompositeOperation = 'source-atop';
      wash.globalAlpha = 0.08;
      wash.drawImage(light, sx + sw * 0.15, sy + sw * 0.15, sw * 0.7, sw * 0.7, 0, 0, px, px);
      wash.globalAlpha = 1;
      context.drawImage(face.wash, 0, 0);
    } else context.drawImage(face.body, 0, 0);
    context.drawImage(face.post, 0, 0);
  }

  root.RondaCarasLuz = {
    create: create, fit: fit, paint: paint, whenReady: whenReady,
    recipeFor: recipeFor, TEAM: TEAM, TEAM_LIGHT: TEAM_LIGHT
  };
})(window);
