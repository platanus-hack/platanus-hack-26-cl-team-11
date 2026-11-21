// Ronda · tarjetas de herramienta. Una por conector, chunky, con una ilustración viva de lo que hace.
// API: RondaTools.create(call) -> { el, update(t) }. call = { name, label, at, end, input, output,
// receipt, privateResult }. t en segundos absolutos del hilo. Movimiento según Stageshow:
// el estado cambia en su propio lugar (States), el spinner gira antes de verse, nada salta.
window.RondaTools = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  const clamp = x => Math.max(0, Math.min(1, x));
  const ease = x => { x = clamp(x); return 1 - Math.pow(1 - x, 3); };
  const smooth = (a, b, x) => { const u = clamp((x - a) / (b - a)); return u * u * (3 - 2 * u); };

  const FLAVORS = {
    week:    { tint: '#1f8a8a', glyph: 'M4 6.5h12M6.5 3v3M13.5 3v3M4.5 5h11a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 14.5v-8A1.5 1.5 0 0 1 4.5 5Z', connector: 'Calendario' },
    cross:   { tint: '#1f8a8a', glyph: 'M3 5h9v6H3zM8 9h9v6H8z', connector: 'Calendario' },
    vault:   { tint: '#a2557a', glyph: 'M5 9h10v7.5H5zM7.5 9V6.5a2.5 2.5 0 0 1 5 0V9', connector: 'Tu política' },
    people:  { tint: '#6b5bb0', glyph: 'M7.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM3 16a4.5 4.5 0 0 1 9 0M13 4.5a2.5 2.5 0 0 1 0 4.8M14.5 11.5A4.5 4.5 0 0 1 17 16', connector: 'Equipo' },
    pulse:   { tint: '#3f8a68', glyph: 'M4 16V11M8 16V7M12 16V9M16 16V4', connector: 'Pulso del equipo' },
    stamp:   { tint: '#b06b22', glyph: 'M8 3h4v5l3 2v2H5v-2l3-2zM4 15h12', connector: 'Permisos' },
    intro:   { tint: '#3f73a8', glyph: 'M7 10a3 3 0 1 1-3-3M13 10a3 3 0 1 0 3-3M7 10h6', connector: 'Presentaciones' },
    note:    { tint: '#8a5a9e', glyph: 'M5 3h10v14H5zM8 7h4M8 10h4M8 13h2', connector: 'Tablero' },
    invite:  { tint: '#1f8a8a', glyph: 'M3 6h14v9H3zM3 6l7 5 7-5', connector: 'Calendario' },
    git:     { tint: '#2f3440', glyph: 'M6 4v12M6 8c0 3 8 1 8 5M14 13v3M6 4a1.5 1.5 0 1 0 0 .01M14 11a1.5 1.5 0 1 0 0 .01', connector: 'GitHub' },
    granola: { tint: '#4f8a3a', glyph: 'M4 10v0M7 7v6M10 5v10M13 7v6M16 9v2', connector: 'Granola' },
    chat:    { tint: '#25a35a', glyph: 'M4 5h12v8H9l-4 3v-3H4z', connector: 'WhatsApp' },
    heart:   { tint: '#d0445f', glyph: 'M10 16s-6-3.6-6-8a3.2 3.2 0 0 1 6-1.6A3.2 3.2 0 0 1 16 8c0 4.4-6 8-6 8Z', connector: 'Salud' },
    generic: { tint: '#6e6e73', glyph: 'M10 3v4M10 13v4M3 10h4M13 10h4', connector: 'Herramienta' }
  };

  function flavorOf(name) {
    const n = String(name || '');
    if (n === 'agenda.cruzar') return 'cross';
    if (n.startsWith('agenda.')) return 'week';
    if (n.startsWith('calendario.')) return 'invite';
    if (n.startsWith('politica.') || n.startsWith('respuesta.')) return 'vault';
    if (n.startsWith('equipo.') || n.startsWith('checkin.')) return 'people';
    if (n.startsWith('pulso.')) return 'pulse';
    if (n.startsWith('permiso.')) return 'stamp';
    if (n.startsWith('presentacion.')) return 'intro';
    if (n.startsWith('propuesta.') || n.startsWith('tablero.')) return 'note';
    if (n.startsWith('github.')) return 'git';
    if (n.startsWith('granola.')) return 'granola';
    if (n.startsWith('whatsapp.')) return 'chat';
    if (n.startsWith('salud.') || n.startsWith('wearable.')) return 'heart';
    return 'generic';
  }

  function h(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
  function s(tag, attrs, parent) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.append(e); return e; }
  function set(e, attrs) { for (const k in attrs) { const v = String(attrs[k]); if (e.getAttribute(k) !== v) e.setAttribute(k, v); } }
  function pretty(v) { return v === undefined ? '' : JSON.stringify(v, null, 2); }
  function pick(obj, keys, fallback) { if (obj) for (const k of keys) if (obj[k] !== undefined) return Array.isArray(obj[k]) ? obj[k].join(' · ') : String(obj[k]); return fallback; }

  // Cada escena dibuja en 300 × 64 y devuelve paint(p, d): p = avance mientras corre, d = llegada del resultado.
  const SCENES = {
    week(g, call) {
      const slots = [], busy = [0, 1, 0, 1, 1, 0, 0, 1], free = [0, 2, 5, 6];
      s('line', { x1: 8, y1: 46, x2: 292, y2: 46, class: 'rt-hair' }, g);
      busy.forEach((b, i) => slots.push(s('rect', { x: 10 + i * 35, y: 18, width: 29, height: 22, rx: 6, class: b ? 'rt-busy' : 'rt-slot' }, g)));
      const lbl = ['9:00', '10:00', '11:00', '12:00'];
      lbl.forEach((t, i) => s('text', { x: 10 + i * 70, y: 60, class: 'rt-tiny' }, g).textContent = t);
      const scan = s('rect', { x: 8, y: 12, width: 3, height: 34, rx: 1.5, class: 'rt-scan' }, g);
      return (p, d) => {
        const x = 8 + 280 * p;
        set(scan, { x: x.toFixed(1), opacity: (1 - d).toFixed(2) });
        busy.forEach((b, i) => { if (b) return; const lit = (x > 10 + i * 35 + 14 ? 1 : 0) || d; set(slots[i], { class: lit ? 'rt-free' : 'rt-slot' }); });
      };
    },
    cross(g, call) {
      const rowA = [0, 1, 1, 0, 0], rowB = [1, 0, 1, 1, 0], both = 2;
      const A = rowA.map((f, i) => s('rect', { x: 60 + i * 46, y: 6, width: 40, height: 18, rx: 6, class: f ? 'rt-free' : 'rt-busy' }, g));
      const B = rowB.map((f, i) => s('rect', { x: 60 + i * 46, y: 30, width: 40, height: 18, rx: 6, class: f ? 'rt-free' : 'rt-busy' }, g));
      const who = Array.isArray(call.participants) && call.participants.length >= 2 ? call.participants : ['Agenda A', 'Agenda B'];
      s('text', { x: 8, y: 19, class: 'rt-tiny' }, g).textContent = who[0];
      s('text', { x: 8, y: 43, class: 'rt-tiny' }, g).textContent = who[1];
      const glow = s('rect', { x: 58 + both * 46, y: 3, width: 44, height: 48, rx: 9, class: 'rt-match' }, g);
      const label = s('text', { x: 60 + both * 46 + 20, y: 62, class: 'rt-tiny rt-strong', 'text-anchor': 'middle' }, g);
      label.textContent = pick(call.output, ['desde'], 'Coincide');
      return (p, d) => {
        const off = (1 - ease(p)) * 22;
        A.forEach(r => set(r, { transform: `translate(${(-off).toFixed(1)} 0)` }));
        B.forEach(r => set(r, { transform: `translate(${off.toFixed(1)} 0)` }));
        set(glow, { opacity: (0.15 + 0.85 * d).toFixed(2), transform: `translate(0 ${((1 - d) * 3).toFixed(1)})` });
        set(label, { opacity: d.toFixed(2) });
      };
    },
    vault(g, call) {
      const bars = [0, 1, 2].map(i => s('rect', { x: 10, y: 10 + i * 16, width: 150 - i * 30, height: 9, rx: 4.5, class: 'rt-line' }, g));
      const veil = [0, 1, 2].map(i => s('rect', { x: 8, y: 7 + i * 16, width: 0, height: 15, rx: 7.5, class: 'rt-veil' }, g));
      const lock = s('g', { transform: 'translate(232 8)' }, g);
      s('rect', { x: 0, y: 20, width: 40, height: 30, rx: 9, class: 'rt-lockbody' }, lock);
      const shackle = s('path', { d: 'M9 21V13a11 11 0 0 1 22 0v8', class: 'rt-shackle' }, lock);
      s('circle', { cx: 20, cy: 34, r: 3.6, class: 'rt-keyhole' }, lock);
      return (p, d) => {
        veil.forEach((v, i) => set(v, { width: (ease(smooth(i * 0.2, i * 0.2 + 0.55, p)) * (154 - i * 30)).toFixed(1) }));
        set(shackle, { transform: `translate(0 ${(-7 * (1 - d) + Math.sin(p * 9) * (1 - d) * 1.2).toFixed(2)})` });
        set(lock, { class: d > 0.5 ? 'rt-locked' : '' });
      };
    },
    people(g, call) {
      const faces = [0, 1, 2, 3, 4].map(i => {
        const c = s('g', { transform: `translate(${34 + i * 52} 30)` }, g);
        s('circle', { r: 17, class: 'rt-face' }, c);
        s('circle', { cx: -5, cy: -2, r: 1.8, class: 'rt-eye' }, c); s('circle', { cx: 5, cy: -2, r: 1.8, class: 'rt-eye' }, c);
        s('path', { d: 'M-5 5q5 4 10 0', class: 'rt-smile' }, c);
        const dot = s('circle', { cx: 13, cy: 13, r: 5, class: 'rt-dot' }, c);
        return { c, dot };
      });
      return (p, d) => faces.forEach((f, i) => {
        const k = ease(smooth(i * 0.15, i * 0.15 + 0.35, p) + d);
        set(f.c, { opacity: (0.25 + 0.75 * k).toFixed(2), transform: `translate(${34 + i * 52} ${(30 + (1 - k) * 6).toFixed(1)}) scale(${(0.86 + 0.14 * k).toFixed(3)})` });
        set(f.dot, { opacity: smooth(0.5, 1, k).toFixed(2) });
      });
    },
    pulse(g, call) {
      // Solo se conocen agregados: aportes contados contra el mínimo y un nivel común. Nunca valores individuales.
      const need = 3;
      const dots = Array.from({ length: need }, (_, i) => s('circle', { cx: 22 + i * 30, cy: 30, r: 10, class: 'rt-slot' }, g));
      s('text', { x: 22, y: 58, class: 'rt-tiny' }, g).textContent = 'Aportes · mínimo ' + need;
      s('rect', { x: 130, y: 22, width: 160, height: 16, rx: 8, class: 'rt-bar' }, g);
      const fill = s('rect', { x: 130, y: 22, width: 0, height: 16, rx: 8, class: 'rt-bar rt-bar-on' }, g);
      const lock = s('text', { x: 210, y: 58, class: 'rt-tiny', 'text-anchor': 'middle' }, g);
      lock.textContent = 'Nivel del equipo';
      return (p, d) => {
        dots.forEach((c, i) => set(c, { class: (smooth(i * 0.25, i * 0.25 + 0.2, p) > 0.5 || d > 0) ? 'rt-free' : 'rt-slot' }));
        set(fill, { width: (160 * 0.62 * ease(d)).toFixed(1) });
        set(lock, { opacity: (0.4 + 0.6 * d).toFixed(2) });
      };
    },
    stamp(g, call) {
      const ticket = s('rect', { x: 70, y: 26, width: 160, height: 34, rx: 8, class: 'rt-ticket' }, g);
      const mark = s('text', { x: 150, y: 49, class: 'rt-stampmark', 'text-anchor': 'middle' }, g);
      mark.textContent = 'Una vez';
      const st = s('g', {}, g);
      s('rect', { x: 128, y: 0, width: 44, height: 16, rx: 6, class: 'rt-stamp' }, st);
      s('rect', { x: 142, y: -10, width: 16, height: 12, rx: 4, class: 'rt-stamp' }, st);
      return (p, d) => {
        const hover = 2 + 3 * (Math.sin(clamp(p) * Math.PI * 3) * 0.5 + 0.5);
        const y = d > 0 ? hover + 9 * Math.sin(Math.min(1, d * 1.6) * Math.PI) : hover;
        set(st, { transform: `translate(0 ${y.toFixed(1)})` });
        set(mark, { opacity: smooth(0.35, 0.7, d).toFixed(2), transform: `rotate(-6 150 44) scale(${(1.15 - 0.15 * smooth(0.35, 0.8, d)).toFixed(3)})` });
        set(ticket, { class: d > 0.4 ? 'rt-ticket rt-ticket-on' : 'rt-ticket' });
      };
    },
    intro(g, call) {
      const left = s('g', {}, g), right = s('g', {}, g);
      s('rect', { x: 0, y: 18, width: 96, height: 28, rx: 14, class: 'rt-chip' }, left);
      s('circle', { cx: 16, cy: 32, r: 9, class: 'rt-face' }, left);
      s('rect', { x: 0, y: 18, width: 96, height: 28, rx: 14, class: 'rt-chip' }, right);
      s('circle', { cx: 80, cy: 32, r: 9, class: 'rt-face' }, right);
      const link = s('line', { x1: 150, y1: 32, x2: 150, y2: 32, class: 'rt-link' }, g);
      const knot = s('circle', { cx: 150, cy: 32, r: 0, class: 'rt-knot' }, g);
      return (p, d) => {
        const k = ease(p);
        set(left, { transform: `translate(${(8 + 30 * k).toFixed(1)} 0)` });
        set(right, { transform: `translate(${(196 - 30 * k).toFixed(1)} 0)` });
        const span = 16 * k;
        set(link, { x1: (150 - span - 6).toFixed(1), x2: (150 + span + 6).toFixed(1), opacity: k.toFixed(2) });
        set(knot, { r: (6 * ease(d)).toFixed(2) });
      };
    },
    note(g, call) {
      s('rect', { x: 80, y: 4, width: 140, height: 56, rx: 10, class: 'rt-paper' }, g);
      const lines = [0, 1, 2].map(i => s('rect', { x: 96, y: 18 + i * 13, width: 0, height: 6, rx: 3, class: 'rt-ink' }, g));
      const pin = s('circle', { cx: 210, cy: 12, r: 0, class: 'rt-pin' }, g);
      const W = [104, 88, 60];
      return (p, d) => {
        lines.forEach((l, i) => set(l, { width: (W[i] * ease(smooth(i * 0.3, i * 0.3 + 0.4, p + d))).toFixed(1) }));
        set(pin, { r: (5 * ease(d)).toFixed(2) });
      };
    },
    invite(g, call) {
      const card = s('g', {}, g);
      s('rect', { x: 0, y: 6, width: 112, height: 52, rx: 10, class: 'rt-paper' }, card);
      s('rect', { x: 0, y: 6, width: 112, height: 14, rx: 10, class: 'rt-band' }, card);
      const t = s('text', { x: 56, y: 44, class: 'rt-big', 'text-anchor': 'middle' }, card);
      t.textContent = pick(call.input, ['inicio', 'desde'], '10:30');
      const badge = s('g', { transform: 'translate(104 10)' }, card);
      s('circle', { r: 10, class: 'rt-badge' }, badge);
      s('path', { d: 'M-4 0l3 3 5-6', class: 'rt-tick' }, badge);
      return (p, d) => {
        set(card, { transform: `translate(${(20 + 150 * ease(p)).toFixed(1)} ${(4 * Math.sin(p * Math.PI)).toFixed(1)}) rotate(${(-4 * (1 - p)).toFixed(2)})` });
        set(badge, { opacity: d.toFixed(2), transform: `translate(104 10) scale(${(0.6 + 0.4 * ease(d)).toFixed(3)})` });
      };
    },
    git(g, call) {
      s('line', { x1: 10, y1: 22, x2: 290, y2: 22, class: 'rt-trunk' }, g);
      const branch = s('path', { d: 'M60 22 C 90 46, 120 46, 150 46 L 220 46 C 250 46, 260 22, 280 22', class: 'rt-branch', 'stroke-dasharray': '300', 'stroke-dashoffset': '300' }, g);
      const commits = [80, 130, 180, 230].map(x => s('circle', { cx: x, cy: 46, r: 0, class: 'rt-commit' }, g));
      const merge = s('circle', { cx: 280, cy: 22, r: 0, class: 'rt-merge' }, g);
      return (p, d) => {
        set(branch, { 'stroke-dashoffset': (300 * (1 - ease(p * 0.8 + d * 0.2))).toFixed(1) });
        commits.forEach((c, i) => set(c, { r: (5 * ease(smooth(0.15 + i * 0.18, 0.3 + i * 0.18, p))).toFixed(2) }));
        set(merge, { r: (7 * ease(d)).toFixed(2) });
      };
    },
    granola(g, call) {
      const bars = Array.from({ length: 28 }, (_, i) => s('rect', { x: 10 + i * 10, y: 32, width: 5, height: 0, rx: 2.5, class: 'rt-wave' }, g));
      const lines = [0, 1].map(i => s('rect', { x: 10, y: 44 + i * 10, width: 0, height: 5, rx: 2.5, class: 'rt-ink' }, g));
      return (p, d) => {
        const T = performance.now() / 1000;
        bars.forEach((b, i) => { const a = (1 - d) * (6 + 12 * Math.abs(Math.sin(i * 0.9 + T * 5))) * Math.min(1, p * 4) + d * 3; set(b, { y: (26 - a / 2).toFixed(1), height: a.toFixed(1) }); });
        lines.forEach((l, i) => set(l, { width: (ease(d - i * 0.15) * (220 - i * 80)).toFixed(1) }));
      };
    },
    chat(g, call) {
      const a = s('rect', { x: 10, y: 6, width: 0, height: 22, rx: 11, class: 'rt-bubble-in' }, g);
      const b = s('rect', { x: 290, y: 34, width: 0, height: 22, rx: 11, class: 'rt-bubble-out' }, g);
      const ticks = s('path', { d: 'M250 50l3 3 5-6M256 50l3 3 5-6', class: 'rt-ticks' }, g);
      return (p, d) => {
        const ka = ease(smooth(0, 0.5, p)), kb = ease(smooth(0.4, 1, p));
        set(a, { width: (150 * ka).toFixed(1) });
        set(b, { width: (120 * kb).toFixed(1), x: (290 - 120 * kb).toFixed(1) });
        set(ticks, { opacity: d.toFixed(2), class: d > 0.5 ? 'rt-ticks rt-ticks-read' : 'rt-ticks' });
      };
    },
    heart(g, call) {
      const path = 'M0 32 H70 L80 32 L88 12 L98 52 L106 26 L114 32 H160 L170 32 L178 14 L188 50 L196 28 L204 32 H300';
      s('path', { d: path, class: 'rt-ecg-ghost' }, g);
      const ecg = s('path', { d: path, class: 'rt-ecg', 'stroke-dasharray': '420', 'stroke-dashoffset': '420' }, g);
      return (p, d) => set(ecg, { 'stroke-dashoffset': (420 * (1 - ease(p * 0.9 + d * 0.1))).toFixed(1) });
    },
    generic(g, call) {
      const bars = [0, 1, 2].map(i => s('rect', { x: 10, y: 12 + i * 15, width: 0, height: 8, rx: 4, class: 'rt-line' }, g));
      return (p, d) => bars.forEach((b, i) => set(b, { width: ((200 - i * 40) * ease(smooth(i * 0.2, i * 0.2 + 0.6, p + d))).toFixed(1) }));
    }
  };

  function create(call) {
    const flavor = flavorOf(call.name), F = FLAVORS[flavor];
    const el = h('article', 'rt-card');
    el.dataset.flavor = flavor;
    el.style.setProperty('--rt-tint', F.tint);

    const head = h('div', 'rt-head');
    const tile = h('span', 'rt-tile'); tile.setAttribute('aria-hidden', 'true');
    tile.innerHTML = `<svg width="20" height="20" viewBox="0 0 20 20"><path d="${F.glyph}"/></svg>`;
    const copy = h('span', 'rt-copy');
    const meta = h('span', 'rt-meta');
    meta.append(h('span', 'rt-connector', F.connector), h('code', 'rt-method', call.name));
    copy.append(h('b', 'rt-label', call.label), meta);
    const status = h('span', 'rt-status');
    const run = h('span', 'rt-run');
    run.innerHTML = '<i class="rt-ico"><svg class="rt-spin" width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="5.5"/><path d="M7 1.5a5.5 5.5 0 0 1 5.5 5.5"/></svg></i>';
    run.append(h('span', '', 'Consultando'));
    const done = h('span', 'rt-done');
    done.innerHTML = call.privateResult
      ? '<i class="rt-ico"><svg width="14" height="14" viewBox="0 0 14 14"><rect x="2.5" y="6" width="9" height="6.5" rx="2"/><path d="M4.8 6V4.3a2.2 2.2 0 0 1 4.4 0V6"/></svg></i>'
      : '<i class="rt-ico"><svg width="14" height="14" viewBox="0 0 14 14"><path class="rt-checkpath" d="M3 7.4l2.6 2.6L11 4.3"/></svg></i>';
    done.append(h('span', '', call.receipt || 'Listo'));
    status.append(run, done);
    head.append(tile, copy, status);

    const stage = h('div', 'rt-stage'); stage.setAttribute('aria-hidden', 'true');
    const svg = s('svg', { viewBox: '0 0 300 64', preserveAspectRatio: 'xMidYMid meet' });
    const g = s('g', {}, svg);
    stage.append(svg);
    const paint = (SCENES[flavor] || SCENES.generic)(g, call);

    const io = h('details', 'rt-io');
    const sum = h('summary', '', 'Entrada y salida');
    const grid = h('div', 'rt-io-grid');
    const outLabel = h('span', 'rt-io-k', 'Salida'), outPre = h('pre', '', pretty(call.output));
    grid.append(h('span', 'rt-io-k', 'Entrada'), h('pre', '', pretty(call.input)), outLabel, outPre);
    io.append(sum, grid);

    el.append(head, stage, io);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let lastState = '';
    return {
      el,
      update(t) {
        const span = Math.max(0.2, call.end - call.at);
        const p = reduced ? 1 : clamp((t - call.at) / span);
        const d = reduced ? (t >= call.end ? 1 : 0) : ease((t - call.end) / 0.6);
        const state = t < call.end ? 'running' : call.privateResult ? 'private' : 'done';
        if (state !== lastState) {
          el.dataset.state = state;
          const finished = state !== 'running';
          outLabel.hidden = !finished; outPre.hidden = !finished;
          lastState = state;
        }
        el.style.setProperty('--rt-d', d.toFixed(3));
        paint(p, d);
        return true;
      }
    };
  }

  return { create, flavorOf, FLAVORS };
})();
