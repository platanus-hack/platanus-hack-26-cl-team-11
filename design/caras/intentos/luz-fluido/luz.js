/*
 * Montu · luz «fluida». Mismo API que luz/luz.js, otro motor: la lava ya no son esferas de cera sino tinta
 * de colores arrastrada por un líquido de verdad (fluidos estables en WebGL2, sin librerías).
 *
 *   RondaLuz.grid(canvas, { cols, rows, cell, palettes, square })  grilla de gotas, una por persona
 *   RondaLuz.sphere(canvas, { palette })                           la misma lava, más calmada, para el globo
 *   RondaLuz.paletteFor(seed), RondaLuz.css(palette), RondaLuz.TONES
 *
 * Cada celda es un recipiente cerrado (círculo): nada cruza de una persona a otra. Dentro hay cuatro tintas (una
 * por tono), una temperatura y una velocidad, guardadas entre cuadros en texturas de ida y vuelta. Abajo el líquido
 * se calienta y arriba se enfría; la cera caliente sube, la fría baja, y por eso se estira, se funde y se parte.
 * La simulación avanza con paso fijo (1/30 s) desde cero hasta el instante pedido, así que render(t) es repetible.
 * Si el navegador no tiene WebGL2 con texturas flotantes, grid y sphere devuelven null.
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

  var STEP = 1 / 30;      // paso fijo de la simulación, en segundos
  var CAP = 600;          // pasos máximos desde cero: render(t) con t > 20 s muestra el estado de los 20 s
  var CATCH = 6;          // pasos máximos por cuadro en tiempo real; si la pestaña se durmió, se salta el resto
  var JACOBI = 20;        // iteraciones de presión por paso (parten de la presión del paso anterior)

  var VERTEX = '#version 300 es\nlayout(location = 0) in vec2 aPos;\nvoid main() { gl_Position = vec4(aPos, 0.0, 1.0); }';

  var COMMON = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
uniform float uN;
uniform vec2 uCells;
const float RW = 0.955;
float hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }
vec2 cellOf(vec2 t) { return floor(t / uN); }
vec2 localP(vec2 t) { vec2 l = t - cellOf(t) * uN; return vec2(2.0 * l.x - uN, uN - 2.0 * l.y) / uN; }
float seedOf(vec2 c) { return hash(c.x * 7.0 + c.y * 131.0 + 17.0); }
bool fluid(vec2 t) {
  vec2 c = cellOf(t);
  if (c.x < 0.0 || c.y < 0.0 || c.x >= uCells.x || c.y >= uCells.y) return false;
  return length(localP(t)) < RW;
}
float wall(vec2 p) { return smoothstep(RW, RW - 0.16, length(p)); }
vec4 hueWeights(float x, float rot, float flip) {
  vec4 w = vec4(0.0);
  for (int j = 0; j < 4; j++) {
    float pj = (-0.72 + 0.48 * float(j)) * flip;
    w[int(mod(float(j) + rot, 4.0))] += exp(-pow((x - pj) / 0.3, 2.0));
  }
  return w / (w.x + w.y + w.z + w.w);
}
float rotOf(float s) { return floor(hash(s * 3.3) * 4.0); }
float flipOf(float s) { return hash(s * 8.7) < 0.5 ? -1.0 : 1.0; }
`;

  var INIT = COMMON + `
layout(location = 0) out vec2 oVel;
layout(location = 1) out vec4 oDye;
layout(location = 2) out float oTemp;
float disc(vec2 p, vec2 c, float r) { return smoothstep(r + 0.035, r - 0.035, length(p - c)); }
void main() {
  vec2 t = gl_FragCoord.xy;
  vec2 c = cellOf(t);
  vec2 p = localP(t);
  float s = seedOf(c);
  float sg = flipOf(s);
  float rot = rotOf(s);
  float pool = smoothstep(0.04, -0.04, p.y - (-0.60 + 0.07 * sin(2.6 * p.x + s * 6.283)));
  vec2 b1 = vec2(-0.40 * sg, -0.02) + (vec2(hash(s * 5.1), hash(s * 6.7)) - 0.5) * 0.16;
  vec2 b2 = vec2(0.42 * sg, 0.40) + (vec2(hash(s * 4.3), hash(s * 9.1)) - 0.5) * 0.16;
  vec2 b3 = vec2(-0.10 * sg, 0.70) + (vec2(hash(s * 2.9), hash(s * 7.3)) - 0.5) * 0.10;
  float t1 = disc(p, b1, 0.27), t2 = disc(p, b2, 0.21), t3 = disc(p, b3, 0.17);
  vec4 d = pool * hueWeights(p.x, rot, sg);
  d[int(mod(rot + 1.0, 4.0))] += t1;
  d[int(mod(rot + 2.0, 4.0))] += t2;
  d[int(mod(rot + 3.0, 4.0))] += t3;
  float total = d.x + d.y + d.z + d.w;
  if (total > 1.0) d /= total;
  float temp = 0.5;
  temp = mix(temp, 1.0, pool);
  temp = mix(temp, 0.86, t1);
  temp = mix(temp, 0.66, t2);
  temp = mix(temp, 0.04, t3);
  bool inside = length(p) < RW;
  oVel = vec2(0.0);
  oDye = inside ? d : vec4(0.0);
  oTemp = inside ? temp : 0.5;
}`;

  var ADVECT = COMMON + `
uniform sampler2D uVel, uDye, uTemp;
uniform float uDt;
layout(location = 0) out vec2 oVel;
layout(location = 1) out vec4 oDye;
layout(location = 2) out float oTemp;
vec2 texelStep(vec2 v) { return vec2(v.x, -v.y) * uN * 0.5; }
void main() {
  vec2 t = gl_FragCoord.xy;
  vec2 size = uCells * uN;
  vec2 c = cellOf(t);
  vec2 lo = c * uN + 0.5, hi = c * uN + uN - 0.5;
  vec2 v0 = textureLod(uVel, t / size, 0.0).xy;
  vec2 mid = clamp(t - 0.5 * uDt * texelStep(v0), lo, hi);
  vec2 v1 = textureLod(uVel, mid / size, 0.0).xy;
  vec2 s = clamp(t - uDt * texelStep(v1), lo, hi) / size;
  oVel = textureLod(uVel, s, 0.0).xy;
  oDye = textureLod(uDye, s, 0.0);
  oTemp = textureLod(uTemp, s, 0.0).x;
}`;

  var FORCE = COMMON + `
uniform sampler2D uVel, uDye, uTemp;
uniform float uDt, uGravity, uDrag, uViscosity;
out vec2 oVel;
void main() {
  vec2 t = gl_FragCoord.xy;
  ivec2 i = ivec2(t);
  vec2 p = localP(t);
  float s = seedOf(cellOf(t));
  vec4 d = texelFetch(uDye, i, 0);
  float wax = clamp(d.x + d.y + d.z + d.w, 0.0, 1.0);
  float th = texelFetch(uTemp, i, 0).x;
  vec2 v = texelFetch(uVel, i, 0).xy;
  vec2 around = vec2(0.0);
  around += fluid(t + vec2(-1.0, 0.0)) ? texelFetch(uVel, i + ivec2(-1, 0), 0).xy : vec2(0.0);
  around += fluid(t + vec2(1.0, 0.0)) ? texelFetch(uVel, i + ivec2(1, 0), 0).xy : vec2(0.0);
  around += fluid(t + vec2(0.0, -1.0)) ? texelFetch(uVel, i + ivec2(0, -1), 0).xy : vec2(0.0);
  around += fluid(t + vec2(0.0, 1.0)) ? texelFetch(uVel, i + ivec2(0, 1), 0).xy : vec2(0.0);
  v = mix(v, around * 0.25, uViscosity);
  v.y += uDt * uGravity * (0.88 + 0.24 * hash(s * 2.7)) * wax * (2.0 * th - 1.0);
  v *= exp(-uDrag * uDt) * wall(p);
  oVel = length(p) < RW ? v : vec2(0.0);
}`;

  var DIVERGENCE = COMMON + `
uniform sampler2D uVel;
out float oDiv;
void main() {
  vec2 t = gl_FragCoord.xy;
  ivec2 i = ivec2(t);
  if (!fluid(t)) { oDiv = 0.0; return; }
  vec2 l = fluid(t + vec2(-1.0, 0.0)) ? texelFetch(uVel, i + ivec2(-1, 0), 0).xy : vec2(0.0);
  vec2 r = fluid(t + vec2(1.0, 0.0)) ? texelFetch(uVel, i + ivec2(1, 0), 0).xy : vec2(0.0);
  vec2 u = fluid(t + vec2(0.0, -1.0)) ? texelFetch(uVel, i + ivec2(0, -1), 0).xy : vec2(0.0);
  vec2 d = fluid(t + vec2(0.0, 1.0)) ? texelFetch(uVel, i + ivec2(0, 1), 0).xy : vec2(0.0);
  oDiv = 0.5 * ((r.x - l.x) + (u.y - d.y));
}`;

  var JACOBI_SRC = COMMON + `
uniform sampler2D uP, uDiv;
out float oP;
void main() {
  vec2 t = gl_FragCoord.xy;
  ivec2 i = ivec2(t);
  if (!fluid(t)) { oP = 0.0; return; }
  float pc = texelFetch(uP, i, 0).x;
  float l = fluid(t + vec2(-1.0, 0.0)) ? texelFetch(uP, i + ivec2(-1, 0), 0).x : pc;
  float r = fluid(t + vec2(1.0, 0.0)) ? texelFetch(uP, i + ivec2(1, 0), 0).x : pc;
  float u = fluid(t + vec2(0.0, -1.0)) ? texelFetch(uP, i + ivec2(0, -1), 0).x : pc;
  float d = fluid(t + vec2(0.0, 1.0)) ? texelFetch(uP, i + ivec2(0, 1), 0).x : pc;
  oP = (l + r + u + d - texelFetch(uDiv, i, 0).x) * 0.25;
}`;

  var PROJECT = COMMON + `
uniform sampler2D uVel, uP;
out vec2 oVel;
void main() {
  vec2 t = gl_FragCoord.xy;
  ivec2 i = ivec2(t);
  if (!fluid(t)) { oVel = vec2(0.0); return; }
  float pc = texelFetch(uP, i, 0).x;
  float l = fluid(t + vec2(-1.0, 0.0)) ? texelFetch(uP, i + ivec2(-1, 0), 0).x : pc;
  float r = fluid(t + vec2(1.0, 0.0)) ? texelFetch(uP, i + ivec2(1, 0), 0).x : pc;
  float u = fluid(t + vec2(0.0, -1.0)) ? texelFetch(uP, i + ivec2(0, -1), 0).x : pc;
  float d = fluid(t + vec2(0.0, 1.0)) ? texelFetch(uP, i + ivec2(0, 1), 0).x : pc;
  oVel = (texelFetch(uVel, i, 0).xy - 0.5 * vec2(r - l, u - d)) * wall(localP(t));
}`;

  var POST = COMMON + `
uniform sampler2D uDye, uTemp;
uniform float uDt, uLevel, uTarget, uHeat, uCool, uSharp, uCompose, uKeep, uTension;
layout(location = 0) out vec4 oDye;
layout(location = 1) out float oTemp;
void main() {
  vec2 t = gl_FragCoord.xy;
  ivec2 i = ivec2(t);
  vec2 c = cellOf(t);
  vec2 p = localP(t);
  if (length(p) >= RW) { oDye = vec4(0.0); oTemp = 0.5; return; }
  float s = seedOf(c);
  vec4 d = texelFetch(uDye, i, 0);
  vec4 near = vec4(0.0);
  near += fluid(t + vec2(-1.0, 0.0)) ? texelFetch(uDye, i + ivec2(-1, 0), 0) : d;
  near += fluid(t + vec2(1.0, 0.0)) ? texelFetch(uDye, i + ivec2(1, 0), 0) : d;
  near += fluid(t + vec2(0.0, -1.0)) ? texelFetch(uDye, i + ivec2(0, -1), 0) : d;
  near += fluid(t + vec2(0.0, 1.0)) ? texelFetch(uDye, i + ivec2(0, 1), 0) : d;
  d = mix(d, near * 0.25, uTension);
  float th = texelFetch(uTemp, i, 0).x;
  float heat = smoothstep(-0.25, -0.85, p.y);
  float cool = smoothstep(0.30, 0.85, p.y);
  th = mix(th, 1.0, 1.0 - exp(-uHeat * heat * uDt));
  th = mix(th, 0.0, 1.0 - exp(-uCool * cool * uDt));
  float wax = d.x + d.y + d.z + d.w;
  if (wax > 1e-4) {
    vec4 home = hueWeights(p.x, rotOf(s), flipOf(s));
    d = mix(d / wax, home, 1.0 - exp(-uCompose * heat * uDt)) * wax;
  }
  vec4 m = textureLod(uDye, (c + 0.5) / uCells, uLevel);
  float mean = m.x + m.y + m.z + m.w;
  d *= clamp(1.0 + uKeep * (uTarget - mean) / uTarget, 0.985, 1.015);
  wax = clamp(d.x + d.y + d.z + d.w, 0.0, 1.3);
  if (wax > 1e-4) {
    float sharp = wax + uSharp * wax * (1.0 - wax) * (wax - 0.5);
    d *= max(sharp, 0.0) / wax;
  }
  oDye = d;
  oTemp = th;
}`;

  var RENDER = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
uniform vec2 uRes;
uniform vec2 uGrid;
uniform float uN, uL2, uL3, uMode, uSquare, uStrength;
uniform sampler2D uDye;
uniform sampler2D uCells;
uniform vec3 uPal[${TONES}];
uniform vec3 uSphere;
uniform ivec4 uSpherePal;
out vec4 outColor;

float hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }

// B-spline cúbico con cuatro lecturas bilineales: bordes suaves aunque la simulación sea de 64 texeles.
vec4 bicubic(vec2 uv, float lod) {
  vec2 sz = vec2(textureSize(uDye, int(lod)));
  vec2 pos = uv * sz - 0.5;
  vec2 ip = floor(pos);
  vec2 f = pos - ip;
  vec2 w0 = (1.0 - f) * (1.0 - f) * (1.0 - f) / 6.0;
  vec2 w1 = (3.0 * f * f * f - 6.0 * f * f + 4.0) / 6.0;
  vec2 w2 = (-3.0 * f * f * f + 3.0 * f * f + 3.0 * f + 1.0) / 6.0;
  vec2 w3 = f * f * f / 6.0;
  vec2 g0 = w0 + w1, g1 = w2 + w3;
  vec2 h0 = (ip - 1.0 + w1 / g0 + 0.5) / sz;
  vec2 h1 = (ip + 1.0 + w3 / g1 + 0.5) / sz;
  return g0.y * (g0.x * textureLod(uDye, vec2(h0.x, h0.y), lod) + g1.x * textureLod(uDye, vec2(h1.x, h0.y), lod))
       + g1.y * (g0.x * textureLod(uDye, vec2(h0.x, h1.y), lod) + g1.x * textureLod(uDye, vec2(h1.x, h1.y), lod));
}
float mass(vec4 d) { return d.x + d.y + d.z + d.w; }

const float LENS = 0.972;

// Gota de vidrio de radio 1 con la tinta de su celda adentro. p: disco con y hacia arriba. Devuelve rgb y cobertura de cera.
vec3 lamp(vec2 p, vec2 cell, vec3 c0, vec3 c1, vec3 c2, vec3 c3, float calm, float aa, out float cover) {
  float r2 = dot(p, p);
  float z = sqrt(max(1.0 - r2, 0.0));
  vec2 atlas = uGrid * uN;
  vec2 q = p * LENS;
  vec2 uv = (cell * uN + vec2(q.x + 1.0, 1.0 - q.y) * 0.5 * uN) / atlas;
  float e = 0.07;
  vec2 ex = vec2(e * 0.5 * uN / atlas.x, 0.0);
  vec2 ey = vec2(0.0, -e * 0.5 * uN / atlas.y);

  vec4 d = bicubic(uv, 0.0);
  float T = mass(d);
  vec4 dg = bicubic(uv, uL3);
  float hC = smoothstep(0.08, 0.9, mass(bicubic(uv, uL2)));
  float hxp = smoothstep(0.08, 0.9, mass(bicubic(uv + ex, uL2)));
  float hxm = smoothstep(0.08, 0.9, mass(bicubic(uv - ex, uL2)));
  float hyp = smoothstep(0.08, 0.9, mass(bicubic(uv + ey, uL2)));
  float hym = smoothstep(0.08, 0.9, mass(bicubic(uv - ey, uL2)));
  vec2 grad = vec2(hxp - hxm, hyp - hym) / (2.0 * e);

  vec3 base = (d.x * c0 + d.y * c1 + d.z * c2 + d.w * c3) / max(T, 1e-3);
  float lum = dot(base, vec3(0.299, 0.587, 0.114));
  base = clamp(mix(vec3(lum), base, 1.25), 0.0, 1.0);

  vec3 n = normalize(vec3(-grad * 0.55, 1.0));
  vec3 L = normalize(vec3(-0.45, 0.75, 0.55));
  vec3 V = vec3(0.0, 0.0, 1.0);
  float wrap = clamp((dot(n, L) + 0.55) / 1.55, 0.0, 1.0);
  vec3 lit = mix(base, vec3(1.0), 0.22);
  vec3 col = mix(base * base * 0.95, lit, smoothstep(0.0, 1.0, wrap));
  col += base * 0.18 * hC;
  float fres = pow(1.0 - clamp(n.z, 0.0, 1.0), 1.6);
  col = mix(col, mix(base, vec3(1.0), 0.5) * 1.05, clamp(fres * 1.4, 0.0, 1.0) * 0.55);
  col = mix(col, mix(base, vec3(1.0), 0.5), (1.0 - hC) * 0.3);
  float nh = max(dot(n, normalize(L + V)), 0.0);
  col += vec3(1.0) * pow(nh, 60.0) * (0.55 - 0.5 * calm);
  col += vec3(1.0) * pow(nh, 9.0) * (0.13 - 0.11 * calm);

  float soft = mix(0.07, 0.2, calm);
  cover = smoothstep(0.5 - soft, 0.5 + soft, T);

  vec3 liq = mix(vec3(1.0), mix(c1, c2, smoothstep(-0.9, 0.9, p.y)), 0.30 - 0.12 * calm);
  liq = mix(liq, c0, smoothstep(0.1, -1.0, p.y) * 0.30);
  float tg = mass(dg);
  vec3 glow = (dg.x * c0 + dg.y * c1 + dg.z * c2 + dg.w * c3) / max(tg, 1e-3);
  liq = mix(liq, mix(glow, vec3(1.0), 0.3), clamp(tg * 1.9, 0.0, 1.0) * 0.6);
  col = mix(liq, col, cover * (1.0 - 0.12 * calm));

  float rim = pow(1.0 - z, 4.0);
  col = mix(col, vec3(1.0), rim * 0.4);
  vec2 dir = normalize(p + 1e-5);
  float band = smoothstep(0.72, 0.9, sqrt(r2)) * smoothstep(1.0, 0.93, sqrt(r2));
  col += vec3(1.0) * band * pow(max(dot(dir, normalize(vec2(-0.62, 0.78))), 0.0), 7.0) * (0.55 - 0.25 * calm);
  col += vec3(1.0) * band * pow(max(dot(dir, normalize(vec2(0.62, -0.78))), 0.0), 5.0) * 0.16;
  return clamp(col, 0.0, 1.0);
}

void main() {
  vec2 frag = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  float cover;
  if (uMode == 0.0) {
    vec2 cellSize = uRes / uGrid;
    vec2 id = floor(frag / cellSize);
    vec2 p = (fract(frag / cellSize) - 0.5) * 2.0;
    p.y = -p.y;
    ivec4 tone = ivec4(texelFetch(uCells, ivec2(id), 0) * 255.0 + 0.5);
    float aa = 2.0 / cellSize.x;
    float r = length(p);
    float alpha = mix(smoothstep(1.0, 1.0 - aa, r), 1.0, uSquare);
    if (r > 0.995) p *= 0.995 / r;
    vec3 col = lamp(p, id, uPal[tone.x], uPal[tone.y], uPal[tone.z], uPal[tone.w], 0.0, aa, cover);
    outColor = vec4(col * alpha, alpha);
  } else {
    vec2 d = (frag - uSphere.xy) / uSphere.z;
    d.y = -d.y;
    float r = length(d);
    if (r > 1.0) { outColor = vec4(0.0); return; }
    float aa = 2.0 / uSphere.z;
    float z = sqrt(max(1.0 - r * r, 0.0));
    vec3 col = lamp(d, vec2(0.0), uPal[uSpherePal.x], uPal[uSpherePal.y], uPal[uSpherePal.z], uPal[uSpherePal.w], 1.0, aa, cover);
    float alpha = clamp(smoothstep(1.0, 1.0 - aa, r) * (0.5 + 0.5 * z) * mix(0.55, 1.0, cover) * uStrength, 0.0, 1.0);
    outColor = vec4(col * alpha, alpha);
  }
}`;

  function link(gl, fragment) {
    function compile(type, source) {
      var shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      return shader;
    }
    var prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    var places = {};
    return {
      prog: prog,
      at: function (name) { if (!(name in places)) places[name] = gl.getUniformLocation(prog, name); return places[name]; }
    };
  }

  /*
   * Todo lo que vive en una grilla de celdas: texturas, pasos de simulación y dibujo.
   * Cada celda ocupa n x n texeles del atlas; n es potencia de 2 para que el nivel log2(n) de la cadena de mips
   * deje un texel con el promedio de cada celda (así se mantiene constante la cantidad de cera).
   */
  function engine(canvas, cols, rows, n, speed, calm) {
    var gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false });
    if (!gl || !gl.getExtension('EXT_color_buffer_float')) return null;
    var width = cols * n, height = rows * n;
    var levels = Math.floor(Math.log2(Math.max(width, height))) + 1;
    var level = Math.log2(n);
    var next = 1;
    var frames = {};
    var programs;
    try {
      programs = {
        init: link(gl, INIT), advect: link(gl, ADVECT), force: link(gl, FORCE), divergence: link(gl, DIVERGENCE),
        jacobi: link(gl, JACOBI_SRC), project: link(gl, PROJECT), post: link(gl, POST), render: link(gl, RENDER)
      };
    } catch (error) {
      if (root.console) root.console.warn('RondaLuz: sombreador no compila', error);
      return null;
    }

    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    function texture(internal, mips) {
      var tex = gl.createTexture();
      tex.id = next++;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texStorage2D(gl.TEXTURE_2D, mips ? levels : 1, internal, width, height);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mips ? gl.LINEAR_MIPMAP_NEAREST : gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return tex;
    }
    var vel = [texture(gl.RG16F), texture(gl.RG16F)];
    var dye = [texture(gl.RGBA16F, true), texture(gl.RGBA16F, true)];
    var temp = [texture(gl.R16F), texture(gl.R16F)];
    var pressure = [texture(gl.R16F), texture(gl.R16F)];
    var divergence = texture(gl.R16F);

    var tones = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tones);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 1, 9, 8]));

    function target(list) {
      var key = list.map(function (tex) { return tex.id; }).join('-');
      if (!frames[key]) {
        var fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        list.forEach(function (tex, index) { gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + index, gl.TEXTURE_2D, tex, 0); });
        gl.drawBuffers(list.map(function (tex, index) { return gl.COLOR_ATTACHMENT0 + index; }));
        frames[key] = fbo;
      }
      return frames[key];
    }

    function constants(program) {
      gl.useProgram(program.prog);
      gl.uniform1f(program.at('uN'), n);
      gl.uniform2f(program.at('uCells'), cols, rows);
    }
    function samplers(program, names) {
      gl.useProgram(program.prog);
      names.forEach(function (name, index) { gl.uniform1i(program.at(name), index); });
    }
    ['init', 'advect', 'force', 'divergence', 'jacobi', 'project', 'post'].forEach(function (name) { constants(programs[name]); });
    samplers(programs.advect, ['uVel', 'uDye', 'uTemp']);
    samplers(programs.force, ['uVel', 'uDye', 'uTemp']);
    samplers(programs.divergence, ['uVel']);
    samplers(programs.jacobi, ['uP', 'uDiv']);
    samplers(programs.project, ['uVel', 'uP']);
    samplers(programs.post, ['uDye', 'uTemp']);
    samplers(programs.render, ['uDye', 'uCells']);

    gl.useProgram(programs.advect.prog); gl.uniform1f(programs.advect.at('uDt'), STEP);
    gl.useProgram(programs.force.prog);
    gl.uniform1f(programs.force.at('uDt'), STEP);
    gl.uniform1f(programs.force.at('uGravity'), calm ? 0.8 : 1.1);
    gl.uniform1f(programs.force.at('uDrag'), calm ? 2.6 : 2.2);
    gl.uniform1f(programs.force.at('uViscosity'), 0.5);
    gl.useProgram(programs.post.prog);
    gl.uniform1f(programs.post.at('uDt'), STEP);
    gl.uniform1f(programs.post.at('uLevel'), level);
    gl.uniform1f(programs.post.at('uTarget'), 0.24);
    gl.uniform1f(programs.post.at('uHeat'), 0.9);
    gl.uniform1f(programs.post.at('uCool'), 0.9);
    gl.uniform1f(programs.post.at('uSharp'), 0.45);
    gl.uniform1f(programs.post.at('uCompose'), 0.6);
    gl.uniform1f(programs.post.at('uKeep'), 0.5);
    gl.uniform1f(programs.post.at('uTension'), 0.35);
    gl.useProgram(programs.render.prog);
    gl.uniform3fv(programs.render.at('uPal'), new Float32Array(PALETTE.reduce(function (list, tone) { return list.concat(tone); }, [])));
    gl.uniform1f(programs.render.at('uN'), n);
    gl.uniform2f(programs.render.at('uGrid'), cols, rows);
    gl.uniform1f(programs.render.at('uL2'), Math.max(level - 4, 0));
    gl.uniform1f(programs.render.at('uL3'), Math.max(level - 3, 1));
    gl.clearColor(0, 0, 0, 0);

    function bind(list) {
      list.forEach(function (tex, index) {
        gl.activeTexture(gl.TEXTURE0 + index);
        gl.bindTexture(gl.TEXTURE_2D, tex);
      });
    }
    function pass(program, out, inputs) {
      gl.useProgram(program.prog);
      bind(inputs);
      gl.bindFramebuffer(gl.FRAMEBUFFER, target(out));
      gl.viewport(0, 0, width, height);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    function mips(tex) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.generateMipmap(gl.TEXTURE_2D);
    }

    var vi = 0, di = 0, pi = 0, done = 0, fresh = true;

    function reset() {
      vi = 0; di = 0; pi = 0; done = 0;
      pass(programs.init, [vel[vi], dye[di], temp[di]], []);
      pressure.forEach(function (tex) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, target([tex]));
        gl.clear(gl.COLOR_BUFFER_BIT);
      });
      fresh = true;
    }

    // Un paso: arrastrar, empujar con la flotación, hacer incompresible, y recalentar, enfriar y reponer la tinta.
    function step() {
      pass(programs.advect, [vel[1 - vi], dye[1 - di], temp[1 - di]], [vel[vi], dye[di], temp[di]]);
      mips(dye[1 - di]);
      pass(programs.force, [vel[vi]], [vel[1 - vi], dye[1 - di], temp[1 - di]]);
      pass(programs.divergence, [divergence], [vel[vi]]);
      for (var k = 0; k < JACOBI; k += 1) {
        pass(programs.jacobi, [pressure[1 - pi]], [pressure[pi], divergence]);
        pi = 1 - pi;
      }
      pass(programs.project, [vel[1 - vi]], [vel[vi], pressure[pi]]);
      vi = 1 - vi;
      pass(programs.post, [dye[di], temp[di]], [dye[1 - di], temp[1 - di]]);
      fresh = true;
    }

    function advance(seconds) {
      var goal = Math.floor(seconds * speed / STEP + 1e-6);
      if (goal < done) reset();
      var limit = done === 0 ? CAP : CATCH;
      if (goal - done > limit) done = goal - limit;
      var from = done;
      for (; done < goal; done += 1) step();
      return done - from;
    }

    function draw(time, setup) {
      advance(time);
      if (fresh) { mips(dye[di]); fresh = false; }
      gl.useProgram(programs.render.prog);
      bind([dye[di], tones]);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(programs.render.at('uRes'), canvas.width, canvas.height);
      setup(programs.render);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    reset();
    return {
      gl: gl,
      tones: function (data, w, h) {
        gl.bindTexture(gl.TEXTURE_2D, tones);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
      },
      draw: draw
    };
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

  function cellSide(cell) { return cell >= 80 ? 64 : 32; }

  function grid(canvas, options) {
    var cols = options.cols, rows = options.rows, cell = options.cell || 128;
    canvas.width = cols * cell; canvas.height = rows * cell;
    var motor = engine(canvas, cols, rows, cellSide(cell), 1, false);
    if (!motor) return null;
    var data = new Uint8Array(cols * rows * 4);
    for (var index = 0; index < cols * rows; index += 1) data.set(options.palettes[index] || paletteFor('persona-' + index), index * 4);
    motor.tones(data, cols, rows);
    return {
      canvas: canvas, cols: cols, rows: rows, cell: cell,
      render: function (time) {
        motor.draw(time, function (render) {
          motor.gl.uniform1f(render.at('uMode'), 0);
          motor.gl.uniform1f(render.at('uSquare'), options.square ? 1 : 0);
        });
      }
    };
  }

  function sphere(canvas, options) {
    var motor = engine(canvas, 1, 1, 64, 0.6, true);
    if (!motor) return null;
    var settings = options || {};
    motor.tones(new Uint8Array([0, 1, 9, 8]), 1, 1);
    var pal = new Int32Array(settings.palette || [0, 9, 7, 5]);
    return {
      canvas: canvas,
      render: function (time, x, y, radius, strength) {
        motor.draw(time, function (render) {
          motor.gl.uniform1f(render.at('uMode'), 1);
          motor.gl.uniform3f(render.at('uSphere'), x, y, radius);
          motor.gl.uniform1f(render.at('uStrength'), strength == null ? 0.5 : strength);
          motor.gl.uniform4iv(render.at('uSpherePal'), pal);
        });
      }
    };
  }

  root.RondaLuz = { grid: grid, sphere: sphere, paletteFor: paletteFor, css: css, TONES: TONES };
})(window);
