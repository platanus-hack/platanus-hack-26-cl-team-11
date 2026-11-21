// Ronda · lo que se ve sobre un arco del grafo mientras su hilo corre.
// Depende de RondaMotion (../mini/motion-paint.js y calendar-edge.js) y de RondaTools.motionKind.
// RondaEdge.state(events, t) dice qué pasa en el arco; RondaEdge.paint(ctx, arc, st, opts) lo dibuja.
//   arc  = { from: {x,y}, to: {x,y}, control: {x,y} }   (curva cuadrática, como en el globo)
//   opts = { size: 44, faces: [img, img] }               (size = ancho de la miniatura en px)
window.RondaEdge = (() => {
  const clamp = x => Math.max(0, Math.min(1, x));
  const ease = x => { x = clamp(x); return 1 - Math.pow(1 - x, 3); };
  const at = (a, c, b, u) => { const v = 1 - u; return { x: v * v * a.x + 2 * v * u * c.x + u * u * b.x, y: v * v * a.y + 2 * v * u * c.y + u * u * b.y }; };
  const TINT = { calendars: '#1f8a8a', health: '#a2557a', permission: '#b06b22', help: '#3f73a8', checkin: '#b07a22', pulse: '#3f8a68', guideline: '#8a5a9e', chat: '#6b5bb0' };

  // El estado del arco en el instante t: escribiendo, herramienta corriendo, recién terminada o quieto.
  function state(events, t) {
    let st = { phase: 'idle' };
    for (const e of events) {
      if (t < e.at) continue;
      if (e.type === 'call') {
        const kind = window.RondaTools ? RondaTools.motionKind(e.name) : 'chat';
        if (t < e.end) st = { phase: 'tool', kind, p: clamp((t - e.at) / Math.max(0.2, e.end - e.at)), author: e.author, call: e };
        else if (t < e.end + 2.2) st = { phase: 'done', kind, d: clamp((t - e.end) / 2.2), author: e.author, call: e };
        else st = { phase: 'receipt', kind, author: e.author, call: e };
      } else if ((e.type === 'message' || e.type === 'human') && t < e.end) {
        st = { phase: 'typing', author: e.author, p: clamp((t - e.at) / Math.max(0.2, e.end - e.at)) };
      }
    }
    return st;
  }

  function plate(ctx, x, y, w, h, r, alpha) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.shadowColor = 'rgba(40,30,90,0.16)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, r); ctx.fill();
    ctx.restore();
  }

  function paint(ctx, arc, st, opts = {}) {
    const size = opts.size || 44, k = size / 64;
    const fromA = st.author === 1 ? arc.to : arc.from, toA = st.author === 1 ? arc.from : arc.to;
    const mid = at(arc.from, arc.control, arc.to, 0.5);
    if (st.phase === 'typing') {
      // Pequeño: la píldora de puntos viaja del que escribe hacia el otro.
      const u = 0.28 + 0.44 * ease(st.p);
      const pt = at(fromA, arc.control, toA, u);
      const w = 30 * Math.max(0.75, k), h = 16 * Math.max(0.75, k);
      plate(ctx, pt.x, pt.y, w, h, h / 2, 1);
      const T = performance.now() / 1000;
      for (let i = 0; i < 3; i++) {
        const lift = Math.max(0, Math.sin(T * 7 - i * 0.7)) * 2;
        ctx.fillStyle = 'rgba(29,29,31,' + (0.35 + 0.35 * (lift / 2)) + ')';
        ctx.beginPath(); ctx.arc(pt.x + (i - 1) * 6 * Math.max(0.75, k), pt.y - lift, 2.1, 0, 6.2832); ctx.fill();
      }
      return { x: pt.x, y: pt.y, r: w / 2 };
    }
    if (st.phase === 'tool' || st.phase === 'done') {
      const d = st.phase === 'done' ? st.d : 0;
      const shrink = 1 - 0.28 * ease(d / 0.5);
      const fade = 1 - ease((d - 0.55) / 0.45);
      const w = 64 * k * shrink, h = 44 * k * shrink;
      plate(ctx, mid.x, mid.y, w + 10, h + 8, 12 * k + 4, fade);
      ctx.save();
      ctx.globalAlpha *= fade;
      ctx.translate(mid.x, mid.y); ctx.scale(k * shrink, k * shrink); ctx.translate(-32, -22);
      try { window.RondaMotion.paint(ctx, st.kind, st.phase === 'tool' ? 0.86 * st.p : 0.86, opts.faces || []); } catch (e) {}
      ctx.restore();
      if (st.phase === 'tool') {
        // Avance de la herramienta: un arco fino alrededor del plato.
        ctx.save(); ctx.strokeStyle = TINT[st.kind] || '#6e6e73'; ctx.lineWidth = 2; ctx.lineCap = 'round';
        ctx.globalAlpha = 0.85;
        ctx.beginPath(); ctx.roundRect(mid.x - (w + 10) / 2, mid.y - (h + 8) / 2, w + 10, h + 8, 12 * k + 4);
        ctx.setLineDash([(2 * (w + h + 18)) * st.p, 4000]); ctx.stroke(); ctx.restore();
      }
      if (d > 0) {
        const pop = ease(d / 0.35), r = 9 * Math.max(0.8, k);
        const bx = mid.x + (w + 10) / 2 - 2, by = mid.y - (h + 8) / 2 + 2;
        const cx = bx + (mid.x - bx) * ease((d - 0.55) / 0.45), cy = by + (mid.y - by) * ease((d - 0.55) / 0.45);
        ctx.save();
        ctx.fillStyle = TINT[st.kind] || '#1d1d1f';
        ctx.beginPath(); ctx.arc(cx, cy, r * pop, 0, 6.2832); ctx.fill();
        ctx.strokeStyle = 'white'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.globalAlpha = pop;
        ctx.beginPath(); ctx.moveTo(cx - 3.5, cy + 0.3); ctx.lineTo(cx - 1, cy + 2.8); ctx.lineTo(cx + 3.8, cy - 2.6); ctx.stroke();
        ctx.restore();
      }
      return { x: mid.x, y: mid.y, r: (w + 10) / 2 };
    }
    if (st.phase === 'receipt') {
      // Queda un punto chico del tinte: aquí ya se usó una herramienta.
      ctx.save(); ctx.fillStyle = TINT[st.kind] || '#1d1d1f';
      ctx.beginPath(); ctx.arc(mid.x, mid.y, 5, 0, 6.2832); ctx.fill();
      ctx.strokeStyle = 'white'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
      return { x: mid.x, y: mid.y, r: 6 };
    }
    return null;
  }

  return { state, paint, TINT };
})();
