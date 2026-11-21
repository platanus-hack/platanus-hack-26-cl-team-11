/*
 * Ronda · luz fluida. Un sombreador WebGL2, sin librerías, con dos usos:
 *   RondaLuz.grid(canvas, opciones)    una grilla de gotas de luz, una por persona (caras «Aura»)
 *   RondaLuz.sphere(canvas, opciones)  la luz dentro del globo de vidrio
 * Si el navegador no tiene WebGL2, ambas devuelven null y quien llama deja su versión quieta.
 */
(function (root) {
  'use strict';

  // Rueda de once tonos. Los vecinos combinan; por eso cada mezcla toma tonos cercanos y un acento.
  var PALETTE = [
    [0.12, 0.61, 1.00], // 0 azul
    [0.22, 0.78, 1.00], // 1 celeste
    [0.18, 0.84, 0.76], // 2 turquesa
    [0.44, 0.86, 0.55], // 3 menta
    [1.00, 0.82, 0.27], // 4 sol
    [1.00, 0.56, 0.16], // 5 naranjo
    [1.00, 0.26, 0.42], // 6 rojo
    [1.00, 0.39, 0.67], // 7 rosa
    [0.90, 0.27, 0.85], // 8 magenta
    [0.50, 0.39, 1.00], // 9 violeta
    [0.33, 0.44, 0.98]  // 10 índigo
  ];
  var TONES = PALETTE.length;

  var VERTEX = '#version 300 es\nin vec2 aPos;\nvoid main() { gl_Position = vec4(aPos, 0.0, 1.0); }';

  var FRAGMENT = [
    '#version 300 es',
    'precision highp float;',
    'uniform vec2 uRes;',
    'uniform float uTime;',
    'uniform vec3 uPal[' + TONES + '];',
    'uniform int uMode;',
    'uniform vec2 uGrid;',
    'uniform sampler2D uCells;',
    'uniform float uSquare;',
    'uniform vec3 uSphere;',
    'uniform ivec4 uSpherePal;',
    'uniform float uStrength;',
    'out vec4 outColor;',
    'float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
    'vec3 fluid(vec2 p, float t, float s, vec3 a, vec3 b, vec3 c, vec3 d) {',
    '  vec2 q = p;',
    '  for (int i = 1; i <= 4; i++) {',
    '    float f = float(i);',
    '    q.x += 0.5 / f * sin(f * 1.25 * q.y + t * (0.55 + 0.11 * f) + s * 6.2831 + f * 1.7);',
    '    q.y += 0.5 / f * cos(f * 1.25 * q.x + t * (0.47 + 0.09 * f) + s * 4.1 + f * 2.3);',
    '  }',
    '  float n1 = 0.5 + 0.5 * sin(q.x * 0.95 + q.y * 0.55 + s * 3.0);',
    '  float n2 = 0.5 + 0.5 * sin(q.y * 1.05 - q.x * 0.45 + 1.7 + s * 5.0);',
    '  float n3 = 0.5 + 0.5 * sin((q.x + q.y) * 0.8 + 3.1 - s * 2.0);',
    '  vec3 col = mix(a, b, smoothstep(0.0, 1.0, n1));',
    '  col = mix(col, c, smoothstep(0.25, 1.0, n2) * 0.85);',
    '  col = mix(col, d, smoothstep(0.45, 1.0, n3) * 0.6);',
    '  return col;',
    '}',
    'void main() {',
    '  vec2 frag = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);',
    '  if (uMode == 0) {',
    '    vec2 cell = uRes / uGrid;',
    '    vec2 id = floor(frag / cell);',
    '    vec2 uv = (fract(frag / cell) - 0.5) * 2.0;',
    '    ivec4 tone = ivec4(texelFetch(uCells, ivec2(id), 0) * 255.0 + 0.5);',
    '    float s = hash(id + 17.0);',
    '    float r = length(uv);',
    '    float z = sqrt(max(0.0, 1.0 - r * r));',
    '    vec2 p = uv * (1.15 - 0.3 * z) * 0.95 + vec2(s * 9.0, s * 5.0);',
    '    vec3 col = fluid(p, uTime, s, uPal[tone.x], uPal[tone.y], uPal[tone.z], uPal[tone.w]);',
    '    col = mix(col, vec3(1.0), 0.07);',
    '    col *= 0.9 + 0.14 * z;',
    '    float rim = pow(1.0 - z, 2.6);',
    '    col = mix(col, vec3(1.0), rim * 0.5);',
    '    col -= 0.09 * smoothstep(0.15, 1.0, uv.y) * (1.0 - rim);',
    '    float alpha = mix(smoothstep(1.0, 0.972, r), 1.0, uSquare);',
    '    outColor = vec4(clamp(col, 0.0, 1.0) * alpha, alpha);',
    '  } else {',
    '    vec2 d = (frag - uSphere.xy) / uSphere.z;',
    '    float r = length(d);',
    '    float z = sqrt(max(0.0, 1.0 - r * r));',
    '    vec2 p = d * (1.12 - 0.26 * z) * 1.85;',
    '    vec3 col = fluid(p, uTime, 0.37, uPal[uSpherePal.x], uPal[uSpherePal.y], uPal[uSpherePal.z], uPal[uSpherePal.w]);',
    '    col = mix(col, vec3(1.0), 0.05);',
    '    float body = smoothstep(1.0, 0.9, r) * (0.34 + 0.66 * z);',
    '    float alpha = clamp(body * uStrength, 0.0, 1.0);',
    '    outColor = vec4(col * alpha, alpha);',
    '  }',
    '}'
  ].join('\n');

  function program(canvas) {
    var gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false });
    if (!gl) return null;
    function compile(type, source) {
      var shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      return shader;
    }
    var prog = gl.createProgram();
    try {
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERTEX));
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAGMENT));
    } catch (error) {
      if (root.console) root.console.warn('RondaLuz: sombreador no compila', error);
      return null;
    }
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);
    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var position = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    var uniform = function (name) { return gl.getUniformLocation(prog, name); };
    gl.uniform3fv(uniform('uPal'), new Float32Array(PALETTE.reduce(function (list, tone) { return list.concat(tone); }, [])));
    var texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 1, 9, 8]));
    gl.uniform1i(uniform('uCells'), 0);
    gl.clearColor(0, 0, 0, 0);
    return { gl: gl, uniform: uniform };
  }

  function draw(kit, canvas, time) {
    var gl = kit.gl;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(kit.uniform('uRes'), canvas.width, canvas.height);
    gl.uniform1f(kit.uniform('uTime'), time);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function seeded(seed) {
    var state = 0x811c9dc5;
    for (var i = 0; i < seed.length; i += 1) { state ^= seed.charCodeAt(i); state = Math.imul(state, 0x01000193); }
    state = state >>> 0 || 0x9e3779b9;
    return function () { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 0x100000000; };
  }

  // Cuatro tonos por persona, todos cercanos en la rueda: el suyo, sus dos vecinos y un acento a dos o tres pasos.
  function paletteFor(seed) {
    var random = seeded('luz:' + seed);
    var base = Math.floor(random() * TONES);
    return [base, (base + 1) % TONES, (base + 2 + Math.floor(random() * 2)) % TONES, (base + TONES - 1) % TONES];
  }

  // Mezcla quieta en CSS para cuando no hay WebGL2 o la persona pidió menos movimiento.
  function css(palette) {
    var spots = [[28, 30], [74, 34], [58, 78], [22, 74]];
    var layers = palette.map(function (tone, index) {
      var rgb = PALETTE[tone].map(function (value) { return Math.round(value * 255); }).join(', ');
      return 'radial-gradient(circle at ' + spots[index][0] + '% ' + spots[index][1] + '%, rgba(' + rgb + ', 0.95) 0, rgba(' + rgb + ', 0) 62%)';
    });
    return layers.join(', ') + ', #f3f2fc';
  }

  function grid(canvas, options) {
    var kit = program(canvas);
    if (!kit) return null;
    var gl = kit.gl, cols = options.cols, rows = options.rows, cell = options.cell || 128;
    canvas.width = cols * cell; canvas.height = rows * cell;
    var data = new Uint8Array(cols * rows * 4);
    for (var index = 0; index < cols * rows; index += 1) data.set(options.palettes[index] || paletteFor('persona-' + index), index * 4);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, cols, rows, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.uniform1i(kit.uniform('uMode'), 0);
    gl.uniform2f(kit.uniform('uGrid'), cols, rows);
    gl.uniform1f(kit.uniform('uSquare'), options.square ? 1 : 0);
    return { canvas: canvas, cols: cols, rows: rows, cell: cell, render: function (time) { draw(kit, canvas, time); } };
  }

  function sphere(canvas, options) {
    var kit = program(canvas);
    if (!kit) return null;
    var gl = kit.gl, settings = options || {};
    gl.uniform1i(kit.uniform('uMode'), 1);
    gl.uniform4iv(kit.uniform('uSpherePal'), new Int32Array(settings.palette || [0, 9, 7, 5]));
    return {
      canvas: canvas,
      render: function (time, x, y, radius, strength) {
        gl.uniform3f(kit.uniform('uSphere'), x, y, radius);
        gl.uniform1f(kit.uniform('uStrength'), strength == null ? 0.5 : strength);
        draw(kit, canvas, time);
      }
    };
  }

  root.RondaLuz = { grid: grid, sphere: sphere, paletteFor: paletteFor, css: css, TONES: TONES };
})(window);
