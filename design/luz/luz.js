/*
 * Montu · luz de lámpara de lava. Un sombreador WebGL2, sin librerías, con dos usos:
 *   RondaLuz.grid(canvas, opciones)    una grilla de gotas de vidrio con lava dentro, una por persona;
 *                                      cada celda puede llevar su propio reloj (ver render) y cambiar de tonos (setCell)
 *   RondaLuz.sphere(canvas, opciones)  la misma lava, más calmada, dentro del globo de vidrio
 * Cada gota es una esfera de vidrio con cinco esferas de cera que suben, bajan, se estiran y se funden
 * por cuellos viscosos (unión suave de distancias, marcha de rayos con refracción).
 * Si el navegador no tiene WebGL2, ambas devuelven null y quien llama deja su versión quieta.
 */
(function (root) {
  'use strict';

  // Tonos 0 a 10: rueda original (los vecinos combinan). 11 a 14: tonos nuevos que se suman a cualquier mezcla.
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
    [0.33, 0.44, 0.98], // 10 índigo
    [0.68, 0.90, 0.28], // 11 lima
    [1.00, 0.44, 0.38], // 12 coral
    [0.74, 0.60, 1.00], // 13 lavanda
    [0.24, 0.92, 0.90]  // 14 agua
  ];
  var TONES = PALETTE.length;
  var WHEEL = 11;
  var EXTRA = [14, 14, 11, 11, 11, 12, 12, 12, 13, 13, 13];

  var VERTEX = '#version 300 es\nin vec2 aPos;\nvoid main() { gl_Position = vec4(aPos, 0.0, 1.0); }';

  var FRAGMENT = `#version 300 es
precision highp float;
precision highp sampler2D;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uPal[${TONES}];
uniform int uMode;
uniform vec2 uGrid;
uniform sampler2D uCells;
uniform sampler2D uPhase;
uniform float uUsePhase;
uniform float uSquare;
uniform vec3 uSphere;
uniform ivec4 uSpherePal;
uniform float uStrength;
out vec4 outColor;

float hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float dist(vec3 q) { return length(vec3(q.x, q.y * 0.82, q.z)); }

const vec3 BASE[5] = vec3[5](vec3(0.0, -1.0, 0.0), vec3(-0.30, -0.1, 0.0), vec3(0.32, 0.15, 0.0), vec3(-0.05, 0.35, 0.0), vec3(0.18, 0.55, 0.0));
const vec3 AMP[5] = vec3[5](vec3(0.20, 0.13, 0.12), vec3(0.34, 0.66, 0.30), vec3(0.36, 0.70, 0.30), vec3(0.40, 0.64, 0.30), vec3(0.42, 0.50, 0.26));
const vec3 FRQ[5] = vec3[5](vec3(0.23, 0.31, 0.17), vec3(0.27, 0.34, 0.21), vec3(0.19, 0.29, 0.25), vec3(0.25, 0.39, 0.18), vec3(0.31, 0.44, 0.27));
const float RAD[5] = float[5](0.58, 0.34, 0.28, 0.31, 0.20);

vec4 blob(int k, float t, float seed) {
  float f = float(k);
  vec3 ph = vec3(hash(seed * 3.1 + f * 1.37), hash(seed * 5.3 + f * 2.11), hash(seed * 7.9 + f * 0.73)) * 6.2831;
  vec3 p = BASE[k] + AMP[k] * sin(FRQ[k] * t + ph);
  if (k > 0) p.y += 0.13 * sin(FRQ[k].y * 2.7 * t + ph.x * 2.0);
  float r = RAD[k] * (1.0 + 0.09 * sin(t * 0.43 + ph.y));
  if (k > 0) p.xy *= min(1.0, (0.96 - r * 0.8) / length(p.xy));
  return vec4(p, r);
}

// Lava dentro de una esfera de vidrio de radio 1. uv: coordenadas del disco con y hacia arriba. Devuelve rgb y cobertura.
vec3 lava(vec2 uv, float t, float seed, vec3 c0, vec3 c1, vec3 c2, vec3 c3, float calm, int nb, int steps, float aa, float sizeMul, out float cover) {
  float r2 = dot(uv, uv);
  float z = sqrt(max(1.0 - r2, 0.0));
  vec3 sn = vec3(uv, z);
  vec3 rd = refract(vec3(0.0, 0.0, -1.0), sn, mix(0.90, 0.93, calm));
  vec3 ro = sn;
  float tmax = -2.0 * dot(ro, rd);

  vec4 bl[5];
  vec3 cols[5] = vec3[5](c0, c1, c2, c3, c0);
  for (int k = 0; k < 5; k++) {
    if (k >= nb) break;
    bl[k] = blob(k, t, seed);
    bl[k].w *= sizeMul;
  }

  float K = mix(6.5, 4.4, calm);
  float KC = K * 2.0;
  float tt = 0.0, minD = 10.0, tmin = 0.0;
  for (int i = 0; i < steps; i++) {
    vec3 p = ro + rd * tt;
    float S = 0.0;
    for (int k = 0; k < 5; k++) {
      if (k >= nb) break;
      S += exp(-K * (dist(p - bl[k].xyz) - bl[k].w));
    }
    float d = -log(S) / K;
    if (d < minD) { minD = d; tmin = tt; }
    if (d < 0.006) break;
    tt += max(d * 0.8, 0.02);
    if (tt > tmax) break;
  }

  vec3 p = ro + rd * tmin;
  float S = 0.0, SC = 0.0;
  vec3 C = vec3(0.0), G = vec3(0.0);
  for (int k = 0; k < 5; k++) {
    if (k >= nb) break;
    vec3 q = p - bl[k].xyz;
    float l = dist(q);
    float dk = l - bl[k].w;
    S += exp(-K * dk);
    float e = exp(-KC * dk);
    SC += e;
    C += e * cols[k];
    G += e * vec3(q.x, q.y * 0.67, q.z) / l;
  }
  vec3 base = C / SC;
  float lum = dot(base, vec3(0.299, 0.587, 0.114));
  base = clamp(mix(vec3(lum), base, 1.22), 0.0, 1.0);
  vec3 n = normalize(G + 1e-5);

  vec3 pin = p + rd * 0.3;
  float Si = 0.0;
  for (int k = 0; k < 5; k++) {
    if (k >= nb) break;
    Si += exp(-K * (dist(pin - bl[k].xyz) - bl[k].w));
  }
  float thick = clamp(log(Si) / K / 0.22, 0.0, 1.0);

  vec3 L = normalize(vec3(-0.45, 0.75, 0.55));
  vec3 V = -rd;
  float wrap = clamp((dot(n, L) + 0.55) / 1.55, 0.0, 1.0);
  vec3 lit = mix(base, vec3(1.0), 0.22);
  vec3 col = mix(base * base * 0.95, lit, smoothstep(0.0, 1.0, wrap));
  col += base * 0.18 * thick;
  float fres = pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 2.5);
  col = mix(col, mix(base, vec3(1.0), 0.5) * 1.05, fres * 0.55);
  col = mix(col, mix(base, vec3(1.0), 0.5), (1.0 - thick) * 0.3);
  float nh = max(dot(n, normalize(L + V)), 0.0);
  col += vec3(1.0) * pow(nh, 60.0) * (0.55 - 0.5 * calm);
  col += vec3(1.0) * pow(nh, 9.0) * (0.13 - 0.11 * calm);

  cover = 1.0 - smoothstep(0.0, mix(aa * 1.6, 0.11, calm), minD - 0.006);

  vec3 liq = mix(vec3(1.0), mix(c1, c2, smoothstep(-0.9, 0.9, uv.y)), 0.30 - 0.12 * calm);
  liq = mix(liq, c0, smoothstep(0.1, -1.0, uv.y) * 0.30);
  float halo = exp(-max(minD, 0.0) * 5.0);
  liq = mix(liq, mix(base, vec3(1.0), 0.3), halo * 0.55);
  col = mix(liq, col, cover * (1.0 - 0.12 * calm));

  float rim = pow(1.0 - z, 4.0);
  col = mix(col, vec3(1.0), rim * 0.4);
  vec2 dir = normalize(uv + 1e-5);
  float band = smoothstep(0.72, 0.9, sqrt(r2)) * smoothstep(1.0, 0.93, sqrt(r2));
  col += vec3(1.0) * band * pow(max(dot(dir, normalize(vec2(-0.62, 0.78))), 0.0), 7.0) * (0.55 - 0.25 * calm);
  col += vec3(1.0) * band * pow(max(dot(dir, normalize(vec2(0.62, -0.78))), 0.0), 5.0) * 0.16;
  return clamp(col, 0.0, 1.0);
}

void main() {
  vec2 frag = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  float cover;
  if (uMode == 0) {
    vec2 cell = uRes / uGrid;
    vec2 id = floor(frag / cell);
    vec2 uv = (fract(frag / cell) - 0.5) * 2.0;
    uv.y = -uv.y;
    ivec4 tone = ivec4(texelFetch(uCells, ivec2(id), 0) * 255.0 + 0.5);
    vec2 own = uUsePhase > 0.5 ? texelFetch(uPhase, ivec2(id), 0).rg : vec2(uTime, 0.0);
    float s = own.g > 0.0 ? own.g : hash(id.x * 7.0 + id.y * 131.0 + 17.0);
    float px = cell.x;
    float aa = 2.0 / px;
    float r = length(uv);
    float alpha = mix(smoothstep(1.0, 1.0 - aa, r), 1.0, uSquare);
    if (r > 0.995) uv *= 0.995 / r;
    int nb = px >= 96.0 ? 5 : (px >= 48.0 ? 4 : 3);
    int steps = px >= 96.0 ? 22 : (px >= 48.0 ? 16 : 12);
    float sizeMul = px >= 96.0 ? 1.0 : (px >= 48.0 ? 1.1 : 1.3);
    float speed = mix(1.0, 1.8, 1.0 - clamp(px / 128.0, 0.0, 1.0));
    float t = own.r * speed + s * 40.0;
    vec3 col = lava(uv, t, s, uPal[tone.x], uPal[tone.y], uPal[tone.z], uPal[tone.w], 0.0, nb, steps, aa, sizeMul, cover);
    outColor = vec4(col * alpha, alpha);
  } else {
    vec2 d = (frag - uSphere.xy) / uSphere.z;
    d.y = -d.y;
    float r = length(d);
    if (r > 1.0) { outColor = vec4(0.0); return; }
    float aa = 2.0 / uSphere.z;
    float z = sqrt(max(1.0 - r * r, 0.0));
    float t = uTime * 0.55 + 11.0;
    vec3 col = lava(d, t, 0.37, uPal[uSpherePal.x], uPal[uSpherePal.y], uPal[uSpherePal.z], uPal[uSpherePal.w], 1.0, 5, 22, aa, 1.15, cover);
    float alpha = clamp(smoothstep(1.0, 1.0 - aa, r) * (0.5 + 0.5 * z) * mix(0.55, 1.0, cover) * uStrength, 0.0, 1.0);
    outColor = vec4(col * alpha, alpha);
  }
}`;

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
    var phase = gl.createTexture();
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, phase);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, 1, 1, 0, gl.RG, gl.FLOAT, new Float32Array(2));
    gl.uniform1i(uniform('uPhase'), 1);
    gl.activeTexture(gl.TEXTURE0);
    gl.clearColor(0, 0, 0, 0);
    return { gl: gl, uniform: uniform, cells: texture, phase: phase };
  }

  function draw(kit, canvas, time, height) {
    var gl = kit.gl;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(kit.uniform('uRes'), canvas.width, canvas.height);
    gl.uniform1f(kit.uniform('uTime'), time);
    if (height && height < canvas.height) { gl.enable(gl.SCISSOR_TEST); gl.scissor(0, canvas.height - height, canvas.width, height); } else gl.disable(gl.SCISSOR_TEST);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function seeded(seed) {
    var state = 0x811c9dc5;
    for (var i = 0; i < seed.length; i += 1) { state ^= seed.charCodeAt(i); state = Math.imul(state, 0x01000193); }
    state = state >>> 0 || 0x9e3779b9;
    return function () { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 0x100000000; };
  }

  // Cuatro tonos por persona: el suyo, su vecino, uno a dos o tres pasos y un acento (el otro vecino o un tono nuevo).
  function paletteFor(seed) {
    var random = seeded('luz:' + seed);
    var base = Math.floor(random() * WHEEL);
    var third = (base + 2 + Math.floor(random() * 2)) % WHEEL;
    var accent = random() < 0.4 ? EXTRA[base] : (base + WHEEL - 1) % WHEEL;
    return [base, (base + 1) % WHEEL, third, accent];
  }

  // Mezcla quieta en CSS para cuando no hay WebGL2 o la persona pidió menos movimiento.
  function css(palette) {
    var spots = [[28, 72], [74, 34], [58, 78], [22, 30]];
    var layers = palette.map(function (tone, index) {
      var rgb = PALETTE[tone].map(function (value) { return Math.round(value * 255); }).join(', ');
      return 'radial-gradient(circle at ' + spots[index][0] + '% ' + spots[index][1] + '%, rgba(' + rgb + ', 0.95) 0, rgba(' + rgb + ', 0) 52%)';
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
    var own = new Float32Array(cols * rows * 2);
    gl.activeTexture(gl.TEXTURE1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, cols, rows, 0, gl.RG, gl.FLOAT, own);
    gl.activeTexture(gl.TEXTURE0);
    return {
      canvas: canvas, cols: cols, rows: rows, cell: cell,
      // Una persona nueva ocupa esa gota: sus cuatro tonos y, si viene, su semilla (entre 0 y 1),
      // que fija cómo se mueve su cera. Con la misma semilla la persona se ve igual en cualquier celda.
      setCell: function (index, palette, seed) {
        gl.texSubImage2D(gl.TEXTURE_2D, 0, index % cols, Math.floor(index / cols), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(palette));
        own[index * 2 + 1] = seed || 0;
      },
      // clocks: un reloj propio por celda, en segundos (Float32Array de cols x rows), para que cada gota vaya a su ritmo.
      // usedRows: dibuja solo las primeras filas, las que tienen gente.
      render: function (time, clocks, usedRows) {
        if (clocks) {
          for (var index = 0; index < cols * rows; index += 1) own[index * 2] = clocks[index];
          gl.activeTexture(gl.TEXTURE1);
          gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, cols, rows, gl.RG, gl.FLOAT, own);
          gl.activeTexture(gl.TEXTURE0);
        }
        gl.uniform1f(kit.uniform('uUsePhase'), clocks ? 1 : 0);
        draw(kit, canvas, time, usedRows ? usedRows * cell : 0);
      }
    };
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

  // El color de un tono, de 0 a 1 por canal: para el halo de una cara.
  function tone(index) { return PALETTE[index % TONES].slice(); }

  root.RondaLuz = { grid: grid, sphere: sphere, paletteFor: paletteFor, css: css, tone: tone, TONES: TONES };
})(window);
