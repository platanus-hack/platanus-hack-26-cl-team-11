// Ronda · en el globo, un solo arco cuenta lo que pasa en su hilo; los demás arcos con hilo
// quedan con un punto chico que se puede tocar. Reemplaza a las miniaturas siempre encendidas.
// Usa globeMotions (mini/motion-globe.js), threadScript (mini/thread-stories.js),
// DemoThreads (mini/threads.js) y RondaEdge (hilo/edge.js).
const RondaEdgeGlobe = (() => {
  const AMBIENT = 14;          // segundos que cada hilo ocupa en la ronda automática
  const scripts = new Map();

  function eventsFor(m, people) {
    const id = DemoThreads.key(m.a, m.b);
    if (!scripts.has(id)) {
      // RondaEdge habla en 0 (quien inicia) y 1 (quien responde).
      const ev = threadScript(m.kind, m.a, m.b, people).map(e => Object.assign({}, e, { author: e.author === m.b ? 1 : 0 }));
      scripts.set(id, ev);
    }
    return scripts.get(id);
  }

  function anchor(a, c, b, points) {
    const occupied = points.filter(p => p && p.z > -0.1 && p.r > 2);
    let best = 0.5, room = -Infinity;
    for (const u of [0.5, 0.42, 0.58, 0.36, 0.64]) {
      const v = 1 - u, x = v * v * a.x + 2 * u * v * c.x + u * u * b.x, y = v * v * a.y + 2 * u * v * c.y + u * u * b.y;
      const r = Math.min(...occupied.map(p => Math.hypot(x - p.x, y - p.y) - p.r));
      if (r > room + 2) { room = r; best = u; }
    }
    return best;
  }

  // Devuelve los puntos tocables, con la forma que espera pickMotionSpot: {kind,a,b,x,y,width,fraction}.
  function paint(ctx, points, control, zoom, seconds, photos, people, selection, reduced) {
    const list = globeMotions.filter(m => selection === 'all' || m.kind === selection);
    const visible = list.filter(m => {
      const a = points[m.a], b = points[m.b];
      if (!a || !b || a.r < 2 || b.r < 2) return false;
      return control(m.a, m.b).z > -0.15;
    });
    if (!visible.length) return [];
    const open = visible.filter(m => DemoThreads.fraction(DemoThreads.key(m.a, m.b), -1, reduced) >= 0);
    const ambientIndex = Math.floor(seconds / AMBIENT) % visible.length;
    const size = (innerWidth < 750 ? 36 : 44) / zoom;
    const spots = [];
    visible.forEach((m, i) => {
      const id = DemoThreads.key(m.a, m.b);
      const a = points[m.a], b = points[m.b], c = control(m.a, m.b);
      const u = anchor(a, c, b, points);
      let t = null;
      if (open.length) { if (open.includes(m)) t = DemoThreads.time(id, reduced); }
      else if (!reduced && i === ambientIndex) t = seconds % AMBIENT;
      const v = 1 - u, mid = { x: v * v * a.x + 2 * u * v * c.x + u * u * b.x, y: v * v * a.y + 2 * u * v * c.y + u * u * b.y };
      let hit = null;
      if (t !== null) {
        const st = RondaEdge.state(eventsFor(m, people), t);
        hit = RondaEdge.paint(ctx, { from: a, to: b, control: c }, st, { size, u, faces: [photos[m.a], photos[m.b]] });
      }
      if (!hit) {
        // Punto en reposo: este arco tiene un hilo que se puede abrir.
        const r = 4.5 / zoom;
        ctx.save();
        ctx.fillStyle = 'rgba(255,255,255,0.96)'; ctx.strokeStyle = 'rgba(29,29,31,0.32)'; ctx.lineWidth = 1.4 / zoom;
        ctx.beginPath(); ctx.arc(mid.x, mid.y, r, 0, 6.2832); ctx.fill(); ctx.stroke();
        ctx.restore();
        hit = { x: mid.x, y: mid.y, r };
      }
      spots.push({ kind: m.kind, a: m.a, b: m.b, x: hit.x, y: hit.y, width: Math.max(28 / zoom, hit.r * 2), fraction: t === null ? 0 : Math.min(0.8, 0.8 * t / DemoThreads.duration) });
    });
    return spots;
  }

  return { paint, AMBIENT };
})();
