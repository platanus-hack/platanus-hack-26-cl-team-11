/*
 * Ronda · luz de lámpara de lava con three.js. Mismo contrato que design/luz/luz.js:
 *   RondaLuz.grid(canvas, { cols, rows, cell, palettes, square })  -> { canvas, cols, rows, cell, render(segundos) } o null
 *   RondaLuz.sphere(canvas, { palette })                           -> { canvas, render(segundos, x, y, radio, fuerza) } o null
 *   RondaLuz.paletteFor(seed), RondaLuz.css(palette), RondaLuz.TONES
 *
 * Es un módulo ES (importa three y MarchingCubes con el import map de la página) y se publica en window.RondaLuz.
 * Un solo WebGLRenderer para toda la página. Cada gota es un vidrio de verdad (MeshPhysicalMaterial con transmisión,
 * dispersión e iridiscencia, reflejando un entorno PMREM teñido con los tonos de la persona) y la cera de adentro
 * depende del tamaño de la celda:
 *   celda >= 128 px  cera como geometría real (MarchingCubes en CPU, material físico con barniz y brillo de seda)
 *   celda  < 128 px  cera analítica en un sombreador (sin CPU), con el mismo vidrio encima
 * Cada llamada a grid/sphere es una escena con todas sus gotas, dibujada en una sola pasada; el resultado se copia
 * al canvas 2D que se devuelve, recortando el borde de la celda para que las gotas vecinas no se vean entre sí.
 */
import * as THREE from 'three';
import { MarchingCubes } from './MarchingCubes.js';

// Tonos 0 a 10: rueda original (los vecinos combinan). 11 a 14: tonos nuevos que se suman a cualquier mezcla.
const PALETTE = [
  [0.12, 0.61, 1.00], [0.22, 0.78, 1.00], [0.18, 0.84, 0.76], [0.44, 0.86, 0.55], [1.00, 0.82, 0.27],
  [1.00, 0.56, 0.16], [1.00, 0.26, 0.42], [1.00, 0.39, 0.67], [0.90, 0.27, 0.85], [0.50, 0.39, 1.00],
  [0.33, 0.44, 0.98], [0.68, 0.90, 0.28], [1.00, 0.44, 0.38], [0.74, 0.60, 1.00], [0.24, 0.92, 0.90]
];
const TONES = PALETTE.length;
const WHEEL = 11;
const EXTRA = [14, 14, 11, 11, 11, 12, 12, 12, 13, 13, 13];

function seeded(seed) {
  let state = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) { state ^= seed.charCodeAt(i); state = Math.imul(state, 0x01000193); }
  state = state >>> 0 || 0x9e3779b9;
  return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 0x100000000; };
}

function paletteFor(seed) {
  const random = seeded('luz:' + seed);
  const base = Math.floor(random() * WHEEL);
  const third = (base + 2 + Math.floor(random() * 2)) % WHEEL;
  const accent = random() < 0.4 ? EXTRA[base] : (base + WHEEL - 1) % WHEEL;
  return [base, (base + 1) % WHEEL, third, accent];
}

function css(palette) {
  const spots = [[28, 72], [74, 34], [58, 78], [22, 30]];
  const layers = palette.map((tone, index) => {
    const rgb = PALETTE[tone].map((value) => Math.round(value * 255)).join(', ');
    return 'radial-gradient(circle at ' + spots[index][0] + '% ' + spots[index][1] + '% , rgba(' + rgb + ', 0.95) 0, rgba(' + rgb + ', 0) 52%)';
  });
  return layers.join(', ') + ', #f3f2fc';
}

/* ---------- Movimiento de la cera: una función pura del instante, la misma para las dos rutas ---------- */

const BASE = [[0, -0.58, 0], [-0.30, -0.08, 0], [0.32, 0.18, 0], [-0.06, 0.40, 0], [0.18, 0.58, 0]];
const AMP = [[0.20, 0.10, 0.12], [0.34, 0.52, 0.30], [0.36, 0.56, 0.30], [0.40, 0.50, 0.30], [0.42, 0.40, 0.26]];
const FRQ = [[0.23, 0.31, 0.17], [0.27, 0.34, 0.21], [0.19, 0.29, 0.25], [0.25, 0.39, 0.18], [0.31, 0.44, 0.27]];
const RAD = [0.46, 0.30, 0.26, 0.28, 0.20];
const WAX_REACH = 0.82;

function hash(n) { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); }

// Llena `out` con [x, y, z, radio] por masa, en unidades de la gota (el vidrio mide 1). `stretch` es cuánto se estira hacia arriba.
function waxAt(seed, time, count, sizeMul, out, stretch) {
  for (let k = 0; k < count; k += 1) {
    const ph0 = hash(seed * 3.1 + k * 1.37) * 6.2831, ph1 = hash(seed * 5.3 + k * 2.11) * 6.2831, ph2 = hash(seed * 7.9 + k * 0.73) * 6.2831;
    let x = BASE[k][0] + AMP[k][0] * Math.sin(FRQ[k][0] * time + ph0);
    let y = BASE[k][1] + AMP[k][1] * Math.sin(FRQ[k][1] * time + ph1);
    let z = BASE[k][2] + AMP[k][2] * Math.sin(FRQ[k][2] * time + ph2);
    if (k > 0) y += 0.12 * Math.sin(FRQ[k][1] * 2.7 * time + ph0 * 2);
    const r = RAD[k] * sizeMul * (1 + 0.09 * Math.sin(time * 0.43 + ph1));
    const len = Math.sqrt(x * x + y * y + z * z), limit = WAX_REACH - r;
    if (len > limit) { const s = limit / len; x *= s; y *= s; z *= s; }
    out[k * 5] = x; out[k * 5 + 1] = y; out[k * 5 + 2] = z; out[k * 5 + 3] = r;
    out[k * 5 + 4] = k === 0 ? 0 : stretch * r * (0.5 + 0.5 * Math.sin(FRQ[k][1] * 1.9 * time + ph2));
  }
}

/* ---------- Escenario: un solo renderer para toda la página ---------- */

let stageCache;
function stage() {
  if (stageCache !== undefined) return stageCache;
  stageCache = null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1280; canvas.height = 720;
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, premultipliedAlpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    if (!renderer.capabilities.isWebGL2) return null;
    renderer.setPixelRatio(1);
    renderer.setSize(canvas.width, canvas.height, false);
    renderer.setClearColor(0x000000, 0);
    renderer.setScissorTest(true);
    stageCache = { renderer, pmrem: new THREE.PMREMGenerator(renderer), envs: new Map(), width: canvas.width, height: canvas.height, flat: new THREE.PlaneGeometry(1, 1) };
  } catch (error) {
    if (window.console) window.console.warn('RondaLuz: no hay WebGL2', error);
  }
  return stageCache;
}

function ensureSize(kit, width, height) {
  if (width <= kit.width && height <= kit.height) return;
  kit.width = Math.max(kit.width, width); kit.height = Math.max(kit.height, height);
  kit.renderer.setSize(kit.width, kit.height, false);
}

function linear(tone) { return new THREE.Color().setRGB(PALETTE[tone][0], PALETTE[tone][1], PALETTE[tone][2], THREE.SRGBColorSpace); }

/* ---------- Entorno: un cuarto de luz teñido con los tonos de la persona, prefiltrado con PMREM ---------- */

const SKY_VERTEX = 'varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const SKY_FRAGMENT = 'uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uLow; varying vec3 vDir; void main() { float h = vDir.y; vec3 c = h > 0.0 ? mix(uMid, uTop, smoothstep(0.0, 0.9, h)) : mix(uMid, uLow, smoothstep(0.0, 0.8, -h)); gl_FragColor = vec4(c, 1.0); }';

function panel(color, width, height, position) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
  mesh.position.set(position[0], position[1], position[2]);
  mesh.lookAt(0, 0, 0);
  return mesh;
}

function envFor(kit, tones) {
  const key = tones.join(',');
  if (kit.envs.has(key)) return kit.envs.get(key);
  const [c0, c1, c2, c3] = tones.map(linear);
  const white = new THREE.Color(1, 1, 1);
  const scene = new THREE.Scene();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(40, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, vertexShader: SKY_VERTEX, fragmentShader: SKY_FRAGMENT,
    uniforms: {
      uTop: { value: white.clone().lerp(c1, 0.22).multiplyScalar(1.15) },
      uMid: { value: white.clone().lerp(c2, 0.5).multiplyScalar(0.85) },
      uLow: { value: c0.clone().multiplyScalar(0.7).lerp(white, 0.15) }
    }
  }));
  scene.add(sky);
  scene.add(panel(new THREE.Color(6, 6, 6), 22, 14, [-20, 24, 20]));
  scene.add(panel(c3.clone().multiplyScalar(5), 18, 26, [26, 2, 12]));
  scene.add(panel(c0.clone().multiplyScalar(4), 30, 12, [0, -16, -14]));
  scene.add(panel(white.clone().multiplyScalar(3), 8, 8, [14, 18, 24]));
  const texture = kit.pmrem.fromScene(scene, 0.02).texture;
  kit.envs.set(key, texture);
  return texture;
}

/* ---------- Fondo líquido y, en la ruta ligera, cera analítica ---------- */

const FLAT_VERTEX = 'varying vec2 vP; void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const FLAT_FRAGMENT = `
uniform vec3 uC0; uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3;
uniform vec4 uB[4];
uniform float uWax; uniform float uAlpha; uniform float uMask;
varying vec2 vP;
const float K = 7.0;
void main() {
  float r = length(vP);
  vec3 liq = mix(vec3(1.0), mix(uC1, uC2, smoothstep(-0.9, 0.9, vP.y)), 0.36);
  liq = mix(liq, uC0, smoothstep(0.1, -1.0, vP.y) * 0.34);
  vec3 col = liq;
  if (uWax > 0.5) {
    vec3 cols[4] = vec3[4](uC0, uC1, uC2, uC3);
    float S = 0.0; float SC = 0.0; vec3 C = vec3(0.0); vec2 G = vec2(0.0);
    for (int k = 0; k < 4; k++) {
      vec2 dv = vP - uB[k].xy;
      float d = length(dv) + 1e-4;
      float rr = uB[k].w * (1.0 + 0.3 * uB[k].z);
      float e = exp(-K * (d - rr));
      float ec = e * e;
      S += e; SC += ec; C += ec * cols[k]; G += e * dv / d;
    }
    float f = -log(S) / K;
    vec3 base = C / SC;
    float lum = dot(base, vec3(0.299, 0.587, 0.114));
    base = clamp(mix(vec3(lum), base, 1.22), 0.0, 1.0);
    float u = clamp(1.0 + f / 0.36, 0.0, 1.0);
    vec3 n = vec3(normalize(G / S + 1e-5) * u, sqrt(max(1.0 - u * u, 0.0)));
    vec3 L = normalize(vec3(-0.45, 0.75, 0.55));
    float wrap = clamp((dot(n, L) + 0.55) / 1.55, 0.0, 1.0);
    vec3 lit = mix(base, vec3(1.0), 0.22);
    vec3 wax = mix(base * base * 0.95, lit, smoothstep(0.0, 1.0, wrap));
    float fres = pow(1.0 - n.z, 2.5);
    wax = mix(wax, mix(base, vec3(1.0), 0.5) * 1.05, fres * 0.5);
    float nh = max(dot(n, normalize(L + vec3(0.0, 0.0, 1.0))), 0.0);
    wax += vec3(pow(nh, 60.0) * 0.55 + pow(nh, 9.0) * 0.12);
    float halo = exp(-max(f, 0.0) * 5.0);
    col = mix(liq, mix(base, vec3(1.0), 0.3), halo * 0.45);
    col = mix(col, clamp(wax, 0.0, 1.0), 1.0 - smoothstep(0.0, 0.035, f));
  }
  float a = uAlpha * mix(1.0, 1.0 - smoothstep(0.95, 1.0, r), uMask);
  gl_FragColor = vec4(pow(col, vec3(2.2)), a);
  #include <colorspace_fragment>
}`;

function flatMaterial(tones, wax, alpha, mask) {
  const colors = tones.map((tone) => new THREE.Vector3(PALETTE[tone][0], PALETTE[tone][1], PALETTE[tone][2]));
  return new THREE.ShaderMaterial({
    vertexShader: FLAT_VERTEX, fragmentShader: FLAT_FRAGMENT,
    uniforms: {
      uC0: { value: colors[0] }, uC1: { value: colors[1] }, uC2: { value: colors[2] }, uC3: { value: colors[3] },
      uB: { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] },
      uWax: { value: wax ? 1 : 0 }, uAlpha: { value: alpha }, uMask: { value: mask ? 1 : 0 }
    }
  });
}

/* ---------- Cera real: MarchingCubes con material físico ---------- */

const WAX_VERTEX_COLORS = '#include <color_fragment>\n  { vec3 vc = vColor; vc /= max(max(vc.r, vc.g), max(vc.b, 1e-3)); float l = dot(vc, vec3(0.299, 0.587, 0.114)); diffuseColor.rgb = clamp(mix(vec3(l), vc, 1.18), 0.0, 1.0); }';
const WAX_GLOW = '#include <emissivemap_fragment>\n  totalEmissiveRadiance += diffuseColor.rgb * 0.34;';

function waxMaterial(env) {
  const material = new THREE.MeshPhysicalMaterial({
    vertexColors: true, roughness: 0.2, metalness: 0, clearcoat: 0.9, clearcoatRoughness: 0.06,
    sheen: 1, sheenRoughness: 0.35, sheenColor: new THREE.Color(1, 1, 1), envMap: env, envMapIntensity: 1.05
  });
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', WAX_VERTEX_COLORS).replace('#include <emissivemap_fragment>', WAX_GLOW);
  };
  return material;
}

const SUBTRACT = 12;
const ISOLATION = 80;
const WAX_SCALE = 0.9;

function pourWax(mc, balls, count, colors) {
  mc.reset();
  for (let k = 0; k < count; k += 1) {
    const radius = balls[k * 5 + 3] / (2 * WAX_SCALE);
    const strength = radius * radius * (ISOLATION + SUBTRACT);
    const bx = (balls[k * 5] / WAX_SCALE + 1) / 2, by = (balls[k * 5 + 1] / WAX_SCALE + 1) / 2, bz = (balls[k * 5 + 2] / WAX_SCALE + 1) / 2;
    const reach = balls[k * 5 + 4] / (2 * WAX_SCALE);
    if (reach > 0.004) {
      mc.addBall(bx, by - reach, bz, strength * 0.8, SUBTRACT, colors[k]);
      mc.addBall(bx, by + reach, bz, strength * 0.8, SUBTRACT, colors[k]);
    } else mc.addBall(bx, by, bz, strength, SUBTRACT, colors[k]);
  }
  mc.update();
}

/* ---------- Vidrio ---------- */

function glassMaterial(env, tones, full, radius) {
  const tint = new THREE.Color(1, 1, 1).lerp(linear(tones[1]), 0.4);
  return new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0, roughness: full ? 0.02 : 0.06, transmission: 1, thickness: full ? 0.4 : 0.4, ior: 1.3,
    dispersion: full ? 1.4 : 0, iridescence: full ? 0.4 : 0, iridescenceIOR: 1.3, iridescenceThicknessRange: [140, 460],
    clearcoat: 1, clearcoatRoughness: 0.03, specularIntensity: 1, envMap: env, envMapIntensity: full ? 1.25 : 1.1,
    attenuationColor: tint, attenuationDistance: radius * 5, transparent: true
  });
}

const shellGeometry = { full: null, light: null };
function shell(full) {
  const key = full ? 'full' : 'light';
  if (!shellGeometry[key]) shellGeometry[key] = full ? new THREE.SphereGeometry(1, 96, 64) : new THREE.SphereGeometry(1, 28, 20);
  return shellGeometry[key];
}

const FULL_AT = 128;
const PAD = 0.12;

/* ---------- Una gota ---------- */

function makeDrop(kit, tones, seed, options) {
  const full = options.full;
  const env = options.env;
  const group = new THREE.Group();
  group.scale.setScalar(options.radius);
  const backdrop = new THREE.Mesh(kit.flat, flatMaterial(tones, !full, options.alpha, options.mask));
  backdrop.scale.setScalar(options.span);
  backdrop.position.z = -0.9;
  group.add(backdrop);
  const drop = { group, seed, balls: new Float32Array(25), full, count: full ? 5 : 4, uniforms: backdrop.material.uniforms, speed: options.speed, sizeMul: options.sizeMul };
  if (full) {
    const colors = [tones[0], tones[1], tones[2], tones[3], tones[0]].map(linear);
    const mc = new MarchingCubes(options.resolution, waxMaterial(env), false, true, options.maxPoly);
    mc.isolation = ISOLATION;
    mc.scale.setScalar(WAX_SCALE);
    group.add(mc);
    drop.mc = mc; drop.colors = colors;
  }
  drop.glass = new THREE.Mesh(shell(full), glassMaterial(env, tones, full, options.radius));
  if (options.mask) drop.glass.material.envMapIntensity = 0.28;
  group.add(drop.glass);
  return drop;
}

function moveDrop(drop, seconds) {
  const time = seconds * drop.speed + drop.seed * 40;
  waxAt(drop.seed, time, drop.count, drop.sizeMul, drop.balls, drop.full ? 0.7 : 0);
  if (drop.full) pourWax(drop.mc, drop.balls, drop.count, drop.colors);
  else for (let k = 0; k < 4; k += 1) drop.uniforms.uB.value[k].set(drop.balls[k * 5], drop.balls[k * 5 + 1], drop.balls[k * 5 + 2], drop.balls[k * 5 + 3]);
}

function makeCamera(width, height) {
  const distance = 5000;
  const camera = new THREE.PerspectiveCamera(2 * Math.atan(height / 2 / distance) * 180 / Math.PI, width / height, 3000, 7000);
  camera.position.set(0, 0, distance);
  return camera;
}

function paintScene(kit, scene, camera, width, height) {
  const renderer = kit.renderer;
  renderer.setViewport(0, 0, width, height);
  renderer.setScissor(0, 0, width, height);
  renderer.clear();
  renderer.render(scene, camera);
}

/* ---------- Grilla de gotas ---------- */

function grid(canvas, options) {
  const kit = stage();
  if (!kit) return null;
  const cols = options.cols, rows = options.rows, cell = options.cell || 128;
  const full = cell >= FULL_AT;
  const pad = Math.round(cell * PAD), span = cell + 2 * pad;
  const width = cols * span, height = rows * span;
  ensureSize(kit, width, height);
  canvas.width = cols * cell; canvas.height = rows * cell;
  const context = canvas.getContext('2d');
  const scene = new THREE.Scene();
  const camera = makeCamera(width, height);
  const radius = cell / 2;
  const drops = [];
  const shared = full ? null : envFor(kit, [9, 1, 7, 2]);
  for (let index = 0; index < cols * rows; index += 1) {
    const tones = options.palettes[index] || paletteFor('persona-' + index);
    const s = hash(Math.floor(index / cols) * 131 + (index % cols) * 7 + 17);
    const small = cell < 48;
    const drop = makeDrop(kit, tones, s, {
      full, env: full ? envFor(kit, tones) : shared, radius, span: span / cell * 2, alpha: 1, mask: false,
      speed: full ? 1.2 : mix(1, 1.8, 1 - Math.min(cell / 128, 1)), sizeMul: small ? 1.3 : (full ? 0.8 : 1), resolution: cell >= 160 ? 34 : 28, maxPoly: 14000
    });
    drop.group.position.set(((index % cols) + 0.5) * span - width / 2, height / 2 - (Math.floor(index / cols) + 0.5) * span, 0);
    scene.add(drop.group);
    drops.push(drop);
  }
  const clip = !options.square;
  return {
    canvas, cols, rows, cell,
    render(seconds) {
      drops.forEach((drop) => moveDrop(drop, seconds));
      paintScene(kit, scene, camera, width, height);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.save();
      if (clip) {
        context.beginPath();
        for (let index = 0; index < drops.length; index += 1) {
          const cx = ((index % cols) + 0.5) * cell, cy = (Math.floor(index / cols) + 0.5) * cell;
          context.moveTo(cx + cell / 2 + 0.5, cy);
          context.arc(cx, cy, cell / 2 + 0.5, 0, 6.2832);
        }
        context.clip();
      }
      const top = kit.height - height;
      for (let index = 0; index < drops.length; index += 1) {
        const column = index % cols, row = Math.floor(index / cols);
        context.drawImage(kit.renderer.domElement, column * span + pad, top + row * span + pad, cell, cell, column * cell, row * cell, cell, cell);
      }
      context.restore();
    }
  };
}

function mix(a, b, t) { return a + (b - a) * t; }

/* ---------- Esfera de vidrio para el globo ---------- */

function sphere(canvas, options) {
  const kit = stage();
  if (!kit) return null;
  const tones = (options && options.palette) || [0, 9, 7, 5];
  const scene = new THREE.Scene();
  const state = { span: 0, camera: null };
  const drop = makeDrop(kit, tones, 0.37, { full: true, env: envFor(kit, tones), radius: 1, span: 2 * (1 + PAD * 2), alpha: 0.2, mask: true, speed: 0.55, sizeMul: 0.55, resolution: 44, maxPoly: 24000 });
  scene.add(drop.group);
  const context = canvas.getContext('2d');
  return {
    canvas,
    render(seconds, x, y, radius, strength) {
      const span = Math.ceil(2 * radius * (1 + PAD * 2));
      if (state.span !== span) { ensureSize(kit, span, span); state.camera = makeCamera(span, span); state.span = span; }
      drop.group.scale.setScalar(radius);
      drop.glass.material.attenuationDistance = radius * 5;
      moveDrop(drop, seconds + 11 / 0.55);
      paintScene(kit, scene, state.camera, span, span);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.globalAlpha = strength == null ? 0.5 : strength;
      context.drawImage(kit.renderer.domElement, 0, kit.height - span, span, span, x - span / 2, y - span / 2, span, span);
      context.globalAlpha = 1;
    }
  };
}

window.RondaLuz = { grid, sphere, paletteFor, css, TONES };
