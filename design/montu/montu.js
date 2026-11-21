(function () {
  const W = 400;
  const H = 600;
  const TAU = Math.PI * 2;

  function seeded(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function spline(control, closed, steps) {
    const out = [];
    const n = control.length;
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const p0 = control[closed ? (i - 1 + n) % n : Math.max(0, i - 1)];
      const p1 = control[i % n];
      const p2 = control[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
      const p3 = control[closed ? (i + 2) % n : Math.min(n - 1, i + 2)];
      for (let k = 0; k < steps; k++) {
        const t = k / steps;
        const t2 = t * t;
        const t3 = t2 * t;
        out.push([
          0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
        ]);
      }
    }
    if (!closed) out.push(control[n - 1]);
    return out;
  }

  function circle(cx, cy, r, steps) {
    const out = [];
    for (let i = 0; i < steps; i++) out.push([cx + r * Math.cos((i / steps) * TAU - Math.PI / 2), cy + r * Math.sin((i / steps) * TAU - Math.PI / 2)]);
    return out;
  }

  function resample(dense, spacing, closed) {
    const pts = closed ? dense.concat([dense[0]]) : dense;
    const lengths = [0];
    for (let i = 1; i < pts.length; i++) lengths.push(lengths[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const total = lengths[lengths.length - 1];
    const count = Math.max(closed ? 3 : 1, Math.round(total / spacing));
    const out = [];
    let seg = 1;
    const samples = closed ? count : count + 1;
    for (let i = 0; i < samples; i++) {
      const target = (i / count) * total;
      while (seg < lengths.length - 1 && lengths[seg] < target) seg++;
      const span = lengths[seg] - lengths[seg - 1] || 1;
      const f = (target - lengths[seg - 1]) / span;
      out.push([pts[seg - 1][0] + (pts[seg][0] - pts[seg - 1][0]) * f, pts[seg - 1][1] + (pts[seg][1] - pts[seg - 1][1]) * f]);
    }
    return out;
  }

  function inside(p, poly) {
    let hit = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i];
      const b = poly[j];
      if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) hit = !hit;
    }
    return hit;
  }

  function delaunay(points) {
    const n = points.length;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of points) {
      minX = Math.min(minX, p[0]);
      minY = Math.min(minY, p[1]);
      maxX = Math.max(maxX, p[0]);
      maxY = Math.max(maxY, p[1]);
    }
    const reach = Math.max(maxX - minX, maxY - minY) * 12;
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    const all = points.concat([[midX - reach, midY - reach], [midX, midY + reach], [midX + reach, midY - reach]]);
    const make = (a, b, c) => {
      const A = all[a];
      const B = all[b];
      const C = all[c];
      const d = 2 * (A[0] * (B[1] - C[1]) + B[0] * (C[1] - A[1]) + C[0] * (A[1] - B[1])) || 1e-9;
      const ux = ((A[0] * A[0] + A[1] * A[1]) * (B[1] - C[1]) + (B[0] * B[0] + B[1] * B[1]) * (C[1] - A[1]) + (C[0] * C[0] + C[1] * C[1]) * (A[1] - B[1])) / d;
      const uy = ((A[0] * A[0] + A[1] * A[1]) * (C[0] - B[0]) + (B[0] * B[0] + B[1] * B[1]) * (A[0] - C[0]) + (C[0] * C[0] + C[1] * C[1]) * (B[0] - A[0])) / d;
      return { a, b, c, x: ux, y: uy, r: (A[0] - ux) * (A[0] - ux) + (A[1] - uy) * (A[1] - uy) };
    };
    let tris = [make(n, n + 1, n + 2)];
    for (let i = 0; i < n; i++) {
      const p = all[i];
      const keep = [];
      const rim = new Map();
      for (const t of tris) {
        if ((p[0] - t.x) * (p[0] - t.x) + (p[1] - t.y) * (p[1] - t.y) < t.r) {
          for (const [u, v] of [[t.a, t.b], [t.b, t.c], [t.c, t.a]]) {
            const key = u < v ? u + '_' + v : v + '_' + u;
            if (rim.has(key)) rim.set(key, null);
            else rim.set(key, [u, v]);
          }
        } else keep.push(t);
      }
      tris = keep;
      for (const edge of rim.values()) if (edge) tris.push(make(edge[0], edge[1], i));
    }
    return tris.filter((t) => t.a < n && t.b < n && t.c < n);
  }

  function plume(side) {
    const inner = 200 + side * 1.4;
    const outline = spline(
      [
        [inner, 208], [inner, 120], [inner, 34], [inner + side * 8, 20], [inner + side * 22, 12], [inner + side * 36, 20],
        [inner + side * 43, 42], [inner + side * 41, 120], [inner + side * 36, 208],
      ],
      true,
      8,
    );
    const quill = [];
    const barbs = [];
    for (let y = 186; y > 36; y -= 17) {
      const x = inner + side * (19 + (208 - y) * 0.014);
      quill.push([x, y]);
      barbs.push([[x - 13, y - 9], [x, y], [x + 13, y - 9]]);
    }
    return { outline: side < 0 ? outline : outline.slice().reverse(), quill, barbs };
  }

  const DISC = { x: 200, y: 204, r: 41 };
  const EYE = [240, 292];
  const PLUME_L = plume(-1);
  const PLUME_R = plume(1);
  const STRIPES = [];
  for (let y = 286; y < 500; y += 26) STRIPES.push({ name: 'stripe' + y, within: 'wig', spacing: 13, line: [[100, y + 9], [240, y - 7]] });

  const PARTS = [
    { name: 'disc', grid: 17, edge: 12.5, depth: -4, outline: circle(DISC.x, DISC.y, DISC.r, 72) },
    {
      name: 'face',
      grid: 18,
      edge: 12,
      depth: 14,
      outline: spline(
        [
          [196, 246], [224, 248], [246, 256], [262, 267], [275, 279], [293, 287], [308, 301], [316, 321], [315, 342], [310, 356], [309, 358],
          [302, 348], [294, 341], [286, 341], [280, 349], [270, 357], [260, 367], [250, 385], [244, 407], [242, 432],
          [216, 432], [216, 398], [210, 364], [199, 332], [189, 300], [187, 270],
        ],
        true,
        6,
      ),
    },
    {
      name: 'wig',
      grid: 60,
      edge: 13,
      depth: -8,
      outline: spline(
        [
          [196, 246], [168, 250], [146, 266], [132, 292], [126, 330], [122, 380], [114, 430], [106, 466], [104, 478], [105, 480],
          [150, 487], [182, 492], [188, 504], [190, 506],
          [228, 504], [230, 502], [226, 470], [221, 448], [216, 432], [216, 398], [210, 364], [199, 332], [189, 300], [187, 270],
        ],
        true,
        6,
      ),
    },
    {
      name: 'torso',
      grid: 28,
      edge: 16,
      depth: -20,
      outline: spline(
        [
          [242, 432], [252, 452], [286, 466], [330, 478], [358, 498], [368, 530], [370, 640], [372, 642], [28, 642], [30, 640], [32, 530],
          [42, 498], [70, 478], [110, 468], [150, 458], [168, 446],
        ],
        true,
        6,
      ),
    },
    { name: 'plumeL', grid: 60, edge: 13, depth: -18, outline: PLUME_L.outline },
    { name: 'plumeR', grid: 60, edge: 13, depth: -18, outline: PLUME_R.outline },
  ];

  const FEATURES = [
    { name: 'brow', within: 'face', spacing: 9, line: spline([[216, 284], [228, 275], [244, 273], [260, 280]], false, 6) },
    { name: 'tear', within: 'face', spacing: 10, line: spline([[240, 306], [238, 322], [230, 338], [218, 342], [214, 332]], false, 6) },
    { name: 'tail', within: 'face', spacing: 10, line: spline([[225, 294], [213, 296], [201, 302]], false, 6) },
    { name: 'gape', within: 'face', spacing: 10, line: spline([[268, 324], [282, 330], [296, 339]], false, 6) },
    { name: 'uraeus', spacing: 8, line: spline([[252, 260], [264, 251], [272, 237], [271, 223], [262, 216]], false, 6) },
    { name: 'quillL', within: 'plumeL', exact: true, line: PLUME_L.quill },
    { name: 'quillR', within: 'plumeR', exact: true, line: PLUME_R.quill },
    ...PLUME_L.barbs.map((barb, i) => ({ name: 'barbL' + i, within: 'plumeL', exact: true, line: barb })),
    ...PLUME_R.barbs.map((barb, i) => ({ name: 'barbR' + i, within: 'plumeR', exact: true, line: barb })),
    ...STRIPES,
    { name: 'collar', within: 'torso', spacing: 15, line: spline([[112, 478], [146, 534], [205, 556], [264, 534], [296, 474]], false, 8) },
  ];

  function build() {
    const random = seeded(26);
    const nodes = [];
    const forced = [];
    const add = (p, part, kind) => {
      nodes.push({ x: p[0], y: p[1], part, kind });
      return nodes.length - 1;
    };
    const tooClose = (p, gap) => nodes.some((q) => Math.hypot(q.x - p[0], q.y - p[1]) < gap);
    const partIndex = (p) => PARTS.findIndex((part) => inside(p, part.outline));

    const eyeIndex = add(EYE, 'eye', 'eye');
    const ring = circle(EYE[0], EYE[1], 11.5, 9).map((p) => add(p, 'eye', 'feature'));
    ring.forEach((id, i) => forced.push([id, ring[(i + 1) % ring.length], 'feature']));
    ring.forEach((id) => forced.push([id, eyeIndex, 'mesh']));

    for (const feature of FEATURES) {
      const ids = [];
      for (const p of feature.exact ? feature.line : resample(feature.line, feature.spacing, false)) {
        if (feature.within && PARTS[partIndex(p)]?.name !== feature.within) continue;
        const near = nodes.findIndex((q) => Math.hypot(q.x - p[0], q.y - p[1]) < 4);
        ids.push(near >= 0 ? near : add(p, feature.within ?? feature.name, 'feature'));
      }
      for (let i = 1; i < ids.length; i++) forced.push([ids[i - 1], ids[i], 'feature']);
    }

    PARTS.forEach((part, index) => {
      const ids = resample(part.outline, part.edge, true).map((p) => {
        const owner = PARTS.findIndex((other, k) => k < index && inside(p, other.outline));
        if (owner >= 0) return -1;
        if (tooClose(p, part.edge * 0.45)) return -1;
        return add(p, part.name, 'contour');
      });
      ids.forEach((id, i) => {
        const next = ids[(i + 1) % ids.length];
        if (id >= 0 && next >= 0) forced.push([id, next, 'contour']);
      });
    });

    PARTS.forEach((part, index) => {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const p of part.outline) {
        minX = Math.min(minX, p[0]);
        minY = Math.min(minY, p[1]);
        maxX = Math.max(maxX, p[0]);
        maxY = Math.max(maxY, p[1]);
      }
      const rowStep = part.grid * 0.87;
      let row = 0;
      for (let y = minY + rowStep * 0.6; y < maxY; y += rowStep, row++) {
        for (let x = minX + (row % 2 ? part.grid / 2 : 0) + part.grid * 0.3; x < maxX; x += part.grid) {
          const p = [x + (random() - 0.5) * part.grid * 0.42, y + (random() - 0.5) * part.grid * 0.42];
          if (!inside(p, part.outline)) continue;
          if (PARTS.some((other, k) => k < index && inside(p, other.outline))) continue;
          if (tooClose(p, part.grid * 0.62)) continue;
          add(p, part.name, 'mesh');
        }
      }
    });

    const points = nodes.map((node) => [node.x, node.y]);
    const triangles = [];
    const edgeKinds = new Map();
    const keyOf = (u, v) => (u < v ? u * 100000 + v : v * 100000 + u);
    for (const t of delaunay(points)) {
      const cx = (points[t.a][0] + points[t.b][0] + points[t.c][0]) / 3;
      const cy = (points[t.a][1] + points[t.b][1] + points[t.c][1]) / 3;
      const owner = partIndex([cx, cy]);
      if (owner < 0) continue;
      const limit = PARTS[owner].grid * 2.3;
      const longest = Math.max(
        Math.hypot(points[t.a][0] - points[t.b][0], points[t.a][1] - points[t.b][1]),
        Math.hypot(points[t.b][0] - points[t.c][0], points[t.b][1] - points[t.c][1]),
        Math.hypot(points[t.c][0] - points[t.a][0], points[t.c][1] - points[t.a][1]),
      );
      if (longest > limit) continue;
      if (Math.hypot(cx - EYE[0], cy - EYE[1]) < 10.5) continue;
      triangles.push({ a: t.a, b: t.b, c: t.c, part: PARTS[owner].name, tone: random(), phase: random() * TAU });
      for (const [u, v] of [[t.a, t.b], [t.b, t.c], [t.c, t.a]]) if (!edgeKinds.has(keyOf(u, v))) edgeKinds.set(keyOf(u, v), 'mesh');
    }
    for (const [u, v, kind] of forced) {
      const current = edgeKinds.get(keyOf(u, v));
      if (!current || kind !== 'mesh') edgeKinds.set(keyOf(u, v), kind);
    }
    const edges = [...edgeKinds].map(([key, kind]) => ({ u: Math.floor(key / 100000), v: key % 100000, kind }));

    const neighbors = nodes.map(() => []);
    for (const edge of edges) {
      neighbors[edge.u].push(edge.v);
      neighbors[edge.v].push(edge.u);
    }
    const depth = nodes.map(() => -1);
    depth[eyeIndex] = 0;
    const queue = [eyeIndex];
    let deepest = 0;
    for (let head = 0; head < queue.length; head++) {
      const at = queue[head];
      for (const next of neighbors[at]) {
        if (depth[next] >= 0) continue;
        depth[next] = depth[at] + 1;
        deepest = Math.max(deepest, depth[next]);
        queue.push(next);
      }
    }
    const depthOf = Object.fromEntries(PARTS.map((part) => [part.name, part.depth]));
    const order = nodes.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    nodes.forEach((node, i) => {
      const reach = depth[i] < 0 ? 1 : depth[i] / deepest;
      const far = Math.hypot(node.x - EYE[0], node.y - EYE[1]) / 330;
      node.rank = Math.min(1, reach * 0.55 + far * 0.45 + random() * 0.05);
      const rise = (DISC.y - node.y) / (DISC.y - 14);
      node.u = node.part === 'disc' ? 0.9 + 0.1 * (1 - (node.y - DISC.y + DISC.r) / (DISC.r * 2)) : node.y < DISC.y ? 1 - 0.5 * Math.max(0, rise) : Math.max(0, Math.min(1, 0.86 - (node.y - 246) / 400));
      const dome = node.part === 'face' || node.part === 'eye' ? 16 * Math.max(0, 1 - Math.hypot(node.x - 226, node.y - 310) / 80) : 0;
      node.z = (depthOf[node.part] ?? 10) + dome;
      const k = order[i] + 0.5;
      const phi = Math.acos(1 - (2 * k) / nodes.length);
      const theta = Math.PI * (1 + Math.sqrt(5)) * k;
      node.sphere = [Math.cos(theta) * Math.sin(phi), Math.cos(phi), Math.sin(theta) * Math.sin(phi)];
      node.twinkle = random() * TAU;
      const sink = Math.max(0, Math.min(1, (node.y - 512) / 84));
      node.fade = 1 - sink * sink * (3 - 2 * sink);
    });
    const strong = nodes.map(() => []);
    for (const edge of edges) {
      if (edge.kind === 'mesh') continue;
      strong[edge.u].push(edge.v);
      strong[edge.v].push(edge.u);
    }
    const rim = nodes.map((node, i) => (node.part === 'disc' && node.kind === 'contour' ? i : -1)).filter((i) => i >= 0);
    return { nodes, edges, triangles, strong, eyeIndex, sun: [rim[0], rim[rim.length >> 1]] };
  }


  const STOPS = [0, 0.3, 0.55, 0.76, 1];
  const TIMING = { eye: 0.1, cloud: 0.15, flight: 0.45, spread: 1.35, travel: 0.75, flash: 0.55, sun: 2.55, done: 3.1 };
  const SPHERE = { x: 200, y: 300, r: 176 };

  const clamp = (v) => Math.max(0, Math.min(1, v));
  const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
  const easeInOut = (t) => {
    const c = clamp(t);
    return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
  };
  const hex2 = (v) => Math.round(clamp(v) * 255).toString(16).padStart(2, '0');

  function ramp(colors) {
    const rgb = colors.map((c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]);
    const out = [];
    for (let i = 0; i < 64; i++) {
      const u = i / 63;
      let k = 0;
      while (k < STOPS.length - 2 && u > STOPS[k + 1]) k++;
      const f = clamp((u - STOPS[k]) / (STOPS[k + 1] - STOPS[k]));
      out.push('#' + [0, 1, 2].map((c) => hex2((rgb[k][c] + (rgb[k + 1][c] - rgb[k][c]) * f) / 255)).join(''));
    }
    return out;
  }

  function create(canvas, figure, palette) {
    const ctx = canvas.getContext('2d');
    const colors = ramp(palette.gradient);
    const colorAt = (u) => colors[Math.round(clamp(u) * 63)];
    const random = seeded(7);
    const { nodes, edges, triangles, strong } = figure;
    const arrive = nodes.map((node) => TIMING.flight + node.rank * TIMING.spread + TIMING.travel);
    const px = new Float32Array(nodes.length);
    const py = new Float32Array(nodes.length);
    const settle = new Float32Array(nodes.length);
    const pulses = [];
    let scale = 1;
    let offsetX = 0;
    let offsetY = 0;

    function resize() {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const box = canvas.getBoundingClientRect();
      canvas.width = Math.round(box.width * ratio);
      canvas.height = Math.round(box.height * ratio);
      scale = Math.min(canvas.width / W, canvas.height / H);
      offsetX = (canvas.width - W * scale) / 2;
      offsetY = (canvas.height - H * scale) / 2;
    }

    function place(t, still) {
      const spin = t * 0.5 + 0.6;
      const cs = Math.cos(spin);
      const sn = Math.sin(spin);
      const tilt = 0.32;
      const ct = Math.cos(tilt);
      const st = Math.sin(tilt);
      const sway = still ? 0 : Math.sin(t * 0.55) * 0.11;
      const cw = Math.cos(sway);
      const sw = Math.sin(sway);
      const breathe = still ? 1 : 1 + Math.sin(t * 0.9) * 0.004;
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const sx = node.sphere[0] * cs + node.sphere[2] * sn;
        const sz = -node.sphere[0] * sn + node.sphere[2] * cs;
        const sy = node.sphere[1] * ct - sz * st;
        const sz2 = node.sphere[1] * st + sz * ct;
        const persp = 1 / (1 - sz2 * 0.22);
        const fromX = SPHERE.x + sx * SPHERE.r * persp;
        const fromY = SPHERE.y + sy * SPHERE.r * persp;
        const dx = node.x - W / 2;
        const toX = W / 2 + (dx * cw + node.z * sw) * breathe;
        const toY = H / 2 + (node.y - H / 2) * breathe;
        const p = easeInOut((t - (arrive[i] - TIMING.travel)) / TIMING.travel);
        settle[i] = p;
        px[i] = fromX + (toX - fromX) * p;
        py[i] = fromY + (toY - fromY) * p;
      }
    }

    function spawnPulse(t) {
      let at = Math.floor(random() * nodes.length);
      for (let guard = 0; guard < 40 && strong[at].length === 0; guard++) at = Math.floor(random() * nodes.length);
      if (strong[at].length === 0) return;
      const path = [at];
      let previous = -1;
      for (let step = 0; step < 16; step++) {
        const options = strong[at].filter((j) => j !== previous && !path.includes(j));
        if (options.length === 0) break;
        previous = at;
        at = options[Math.floor(random() * options.length)];
        path.push(at);
      }
      if (path.length > 4) pulses.push({ path, born: t, speed: 9 + random() * 4 });
    }

    function draw(t, still) {
      place(t, still);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const cloud = easeOut((t - TIMING.cloud) / 0.5);
      const sun = easeOut((t - TIMING.sun) / 0.7);

      if (sun > 0) {
        const cx = (px[figure.sun[0]] + px[figure.sun[1]]) / 2;
        const cy = (py[figure.sun[0]] + py[figure.sun[1]]) / 2;
        const glow = ctx.createRadialGradient(cx, cy, 8, cx, cy, 150);
        const warm = colorAt(0.92);
        glow.addColorStop(0, warm + hex2(0.34 * sun * (still ? 1 : 0.85 + 0.15 * Math.sin(t * 1.3))));
        glow.addColorStop(0.45, colorAt(0.74) + hex2(0.12 * sun));
        glow.addColorStop(1, colorAt(0.6) + '00');
        ctx.globalAlpha = 1;
        ctx.fillStyle = glow;
        ctx.fillRect(cx - 160, cy - 160, 320, 320);
      }

      for (const tri of triangles) {
        const ready = Math.max(arrive[tri.a], arrive[tri.b], arrive[tri.c]);
        const shown = easeOut((t - ready) / 0.6) * Math.min(nodes[tri.a].fade, nodes[tri.b].fade, nodes[tri.c].fade);
        if (shown <= 0) continue;
        const base = tri.part === 'disc' ? 0.3 + tri.tone * 0.22 + sun * 0.12 : 0.05 + tri.tone * 0.11;
        const shimmer = still ? 0 : Math.sin(t * 1.1 + tri.phase) * 0.035;
        ctx.globalAlpha = Math.max(0, (base + shimmer) * shown);
        ctx.fillStyle = colorAt((nodes[tri.a].u + nodes[tri.b].u + nodes[tri.c].u) / 3);
        ctx.beginPath();
        ctx.moveTo(px[tri.a], py[tri.a]);
        ctx.lineTo(px[tri.b], py[tri.b]);
        ctx.lineTo(px[tri.c], py[tri.c]);
        ctx.closePath();
        ctx.fill();
      }

      for (const edge of edges) {
        const ready = Math.max(arrive[edge.u], arrive[edge.v]);
        const formed = clamp((t - ready) / 0.25);
        const flash = formed > 0 ? 1 - clamp((t - ready) / TIMING.flash) : 0;
        const tangled = cloud * (0.06 + 0.1 * Math.min(settle[edge.u], settle[edge.v]));
        const rest = edge.kind === 'contour' ? 0.95 : edge.kind === 'feature' ? 0.8 : 0.3;
        const width = edge.kind === 'contour' ? 1.5 : edge.kind === 'feature' ? 1.25 : 0.75;
        ctx.strokeStyle = colorAt((nodes[edge.u].u + nodes[edge.v].u) / 2);
        const fade = 1 + (Math.min(nodes[edge.u].fade, nodes[edge.v].fade) - 1) * formed;
        if (fade <= 0.01) continue;
        ctx.globalAlpha = (tangled + (rest - tangled) * formed) * fade;
        ctx.lineWidth = 0.6 + (width - 0.6) * formed + flash * 1.4;
        if (flash > 0.05) {
          ctx.shadowColor = ctx.strokeStyle;
          ctx.shadowBlur = 14 * flash;
        }
        ctx.beginPath();
        ctx.moveTo(px[edge.u], py[edge.u]);
        ctx.lineTo(px[edge.v], py[edge.v]);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      if (!still && t > TIMING.done) {
        if (pulses.length < 5 && random() < 0.05) spawnPulse(t);
        for (let k = pulses.length - 1; k >= 0; k--) {
          const pulse = pulses[k];
          const head = (t - pulse.born) * pulse.speed;
          if (head > pulse.path.length + 3) {
            pulses.splice(k, 1);
            continue;
          }
          ctx.strokeStyle = palette.light;
          ctx.shadowColor = colorAt(nodes[pulse.path[0]].u);
          ctx.shadowBlur = 10;
          ctx.lineWidth = 2.4;
          for (let s = 0; s < pulse.path.length - 1; s++) {
            const glow = 1 - Math.abs(head - 1.5 - s) / 2.2;
            if (glow <= 0) continue;
            ctx.globalAlpha = glow * 0.95;
            ctx.beginPath();
            ctx.moveTo(px[pulse.path[s]], py[pulse.path[s]]);
            ctx.lineTo(px[pulse.path[s + 1]], py[pulse.path[s + 1]]);
            ctx.stroke();
          }
          ctx.shadowBlur = 0;
        }
      }

      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (node.kind === 'eye') continue;
        const landed = clamp((t - arrive[i]) / 0.35);
        const pop = landed > 0 && landed < 1 ? Math.sin(landed * Math.PI) * 1.6 : 0;
        const radius = (node.kind === 'mesh' ? 1.25 : 1.75) + pop;
        const flying = cloud * (0.35 + 0.3 * Math.sin(t * 2.2 + node.twinkle));
        ctx.globalAlpha = settle[i] < 1 ? Math.max(0.15, flying) * (1 + (node.fade - 1) * settle[i]) : node.fade;
        if (ctx.globalAlpha <= 0.01) continue;
        ctx.fillStyle = settle[i] < 1 ? colorAt(node.u) : palette.light;
        ctx.strokeStyle = colorAt(node.u);
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.arc(px[i], py[i], radius, 0, TAU);
        ctx.fill();
        if (settle[i] >= 1) ctx.stroke();
      }

      const eye = figure.eyeIndex;
      const open = easeOut((t - TIMING.eye) / 0.5);
      if (open > 0) {
        const beat = still ? 0 : Math.sin(t * 2.4) * 0.5 + 0.5;
        ctx.globalAlpha = 0.2 * open * (1 - beat * 0.6);
        ctx.fillStyle = colorAt(0.55);
        ctx.beginPath();
        ctx.arc(px[eye], py[eye], 9 + beat * 7, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = open;
        ctx.fillStyle = palette.ink;
        ctx.beginPath();
        ctx.arc(px[eye], py[eye], 6.2 * open, 0, TAU);
        ctx.fill();
        ctx.fillStyle = palette.light;
        ctx.beginPath();
        ctx.arc(px[eye] + 2, py[eye] - 2.1, 1.6, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    resize();
    return { draw, resize };
  }


  const GRADIENT_TOKENS = ['--rd-g1', '--rd-g2', '--rd-g3', '--rd-g4', '--rd-g5'];
  const FORMED_SECONDS = TIMING.done;
  const STILL_SECONDS = 60;
  const REDUCED_INTRO_MS = 900;
  let figure = null;

  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function mount(canvas, options) {
    const settings = options || {};
    const style = getComputedStyle(document.documentElement);
    const token = (name) => style.getPropertyValue(name).trim();
    const palette = { gradient: GRADIENT_TOKENS.map(token), ink: token('--rd-ink'), light: token('--rd-on-ink') };
    figure = figure || build();
    const view = create(canvas, figure, palette);
    const still = settings.at !== undefined || reducedMotion();
    const stillAt = settings.at !== undefined ? settings.at : STILL_SECONDS;
    let frame = 0;
    let start = performance.now();
    const tick = (now) => {
      view.draw((now - start) / 1000, false);
      frame = requestAnimationFrame(tick);
    };
    if (still) view.draw(stillAt, true);
    else frame = requestAnimationFrame(tick);
    const observer = new ResizeObserver(() => {
      view.resize();
      if (still) view.draw(stillAt, true);
    });
    observer.observe(canvas);
    return {
      replay() {
        start = performance.now();
      },
      destroy() {
        cancelAnimationFrame(frame);
        observer.disconnect();
      },
    };
  }

  window.RondaMontu = { mount, introMs: () => (reducedMotion() ? REDUCED_INTRO_MS : FORMED_SECONDS * 1000) };
})();
