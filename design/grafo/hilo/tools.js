// Ronda · tarjetas de herramienta. Una por conector, chunky, con una ilustración viva de lo que hace.
// API: RondaTools.create(call) -> { el, update(t) }. call = { name, label, at, end, input, output,
// receipt, privateResult }. t en segundos absolutos del hilo. Movimiento según Stageshow:
// el estado cambia en su propio lugar (States), el spinner gira antes de verse, nada salta.
window.RondaTools = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  const HERE = (document.currentScript && document.currentScript.src) || location.href;
  const FACE_BASE = new URL('../../faces/', HERE).href;
  const DEFAULT_FACES = ['ian', 'lian', 'andres', 'roberto', 'mati'].map(n => FACE_BASE + n + '.png');
  let uid = 0;
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

  // Miniatura del globo que corresponde a cada herramienta (kinds de RondaMotion).
  function motionKind(name) {
    const n = String(name || '');
    if (n.startsWith('agenda.') || n.startsWith('calendario.')) return 'calendars';
    if (n.startsWith('politica.') || n.startsWith('respuesta.') || n.startsWith('salud.') || n.startsWith('wearable.')) return 'health';
    if (n.startsWith('permiso.')) return 'permission';
    if (n.startsWith('presentacion.')) return 'help';
    if (n.startsWith('checkin.')) return 'checkin';
    if (n.startsWith('pulso.')) return 'pulse';
    if (n.startsWith('propuesta.') || n.startsWith('tablero.')) return 'guideline';
    return 'chat';
  }

  // Una cara redonda real, con aro blanco, como en el resto de Ronda.
  function face(g, x, y, r, url) {
    const id = 'rtf' + (++uid);
    const cp = s('clipPath', { id }, g); s('circle', { cx: x, cy: y, r }, cp);
    s('circle', { cx: x, cy: y, r: r + 2, class: 'rt-facering' }, g);
    s('image', { href: url, x: x - r, y: y - r, width: r * 2, height: r * 2, 'clip-path': `url(#${id})`, preserveAspectRatio: 'xMidYMid slice' }, g);
  }

  function h(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
  function s(tag, attrs, parent) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.append(e); return e; }
  function set(e, attrs) { for (const k in attrs) { const v = String(attrs[k]); if (e.getAttribute(k) !== v) e.setAttribute(k, v); } }
  function pretty(v) { return v === undefined ? '' : JSON.stringify(v, null, 2); }
  function pick(obj, keys, fallback) { if (obj) for (const k of keys) if (obj[k] !== undefined) return Array.isArray(obj[k]) ? obj[k].join(' · ') : String(obj[k]); return fallback; }

  // Cada escena dibuja en 300 × 64 y devuelve paint(p, d): p = avance mientras corre, d = llegada del resultado.
  // Un objeto y un gesto por escena. Relieve (clase rt-mark) solo en las marcas de datos, nunca en el texto.
  const SCENES = {
    week(g, call) {
      const busy = [0, 1, 0, 1, 1, 0, 0, 1];
      const marks = s('g', { class: 'rt-mark' }, g);
      const slots = busy.map((b, i) => s('rect', { x: 10 + i * 35, y: 14, width: 29, height: 24, rx: 6, class: b ? 'rt-busy' : 'rt-slot' }, marks));
      ['9:00', '10:00', '11:00', '12:00'].forEach((t, i) => s('text', { x: 10 + i * 70, y: 58, class: 'rt-tiny' }, g).textContent = t);
      const scan = s('rect', { x: 8, y: 8, width: 3, height: 36, rx: 1.5, class: 'rt-scan' }, g);
      return (p, d) => {
        const x = 8 + 280 * p;
        set(scan, { x: x.toFixed(1), opacity: (1 - d).toFixed(2) });
        busy.forEach((b, i) => { if (b) return; const lit = x > 10 + i * 35 + 14 || d > 0; set(slots[i], { class: lit ? 'rt-free' : 'rt-slot' }); });
      };
    },
    cross(g, call) {
      const rowA = [0, 1, 1, 0, 0], rowB = [1, 0, 1, 1, 0], both = 2;
      const ma = s('g', { class: 'rt-mark' }, g), mb = s('g', { class: 'rt-mark' }, g);
      rowA.forEach((f, i) => s('rect', { x: 60 + i * 46, y: 6, width: 40, height: 18, rx: 6, class: f ? 'rt-free' : 'rt-busy' }, ma));
      rowB.forEach((f, i) => s('rect', { x: 60 + i * 46, y: 30, width: 40, height: 18, rx: 6, class: f ? 'rt-free' : 'rt-busy' }, mb));
      const who = Array.isArray(call.participants) && call.participants.length >= 2 ? call.participants : ['Agenda A', 'Agenda B'];
      s('text', { x: 8, y: 19, class: 'rt-tiny' }, g).textContent = who[0];
      s('text', { x: 8, y: 43, class: 'rt-tiny' }, g).textContent = who[1];
      const glow = s('rect', { x: 57 + both * 46, y: 2, width: 46, height: 50, rx: 6, class: 'rt-match', opacity: 0 }, g);
      const label = s('text', { x: 60 + both * 46 + 20, y: 64, class: 'rt-tiny rt-strong', 'text-anchor': 'middle', opacity: 0 }, g);
      label.textContent = pick(call.output, ['desde'], 'Coincide');
      return (p, d) => {
        const off = (1 - ease(p + d)) * 22;
        set(ma, { transform: `translate(${(-off).toFixed(1)} 0)` });
        set(mb, { transform: `translate(${off.toFixed(1)} 0)` });
        set(glow, { opacity: d.toFixed(2) });
        set(label, { opacity: d.toFixed(2) });
      };
    },
    vault(g, call) {
      // Tres datos se tapan uno a uno con el tinte y el candado se cierra.
      const W = [150, 120, 90];
      const marks = s('g', { class: 'rt-mark' }, g);
      W.forEach((w, i) => s('rect', { x: 20, y: 12 + i * 15, width: w, height: 9, rx: 4.5, class: 'rt-line' }, marks));
      const veil = W.map((w, i) => s('rect', { x: 20, y: 12 + i * 15, width: 0, height: 9, rx: 4.5, class: 'rt-veil' }, g));
      const lock = s('g', { transform: 'translate(226 6)' }, g);
      const shackle = s('path', { d: 'M10 22V14a10 10 0 0 1 20 0v8', class: 'rt-shackle' }, lock);
      const body = s('g', { class: 'rt-mark' }, lock);
      s('rect', { x: 2, y: 22, width: 36, height: 28, rx: 6, class: 'rt-lockbody' }, body);
      s('circle', { cx: 20, cy: 35, r: 3.5, class: 'rt-keyhole' }, lock);
      return (p, d) => {
        veil.forEach((v, i) => set(v, { width: (ease(smooth(i * 0.2, i * 0.2 + 0.5, p + d)) * W[i]).toFixed(1) }));
        set(shackle, { transform: `translate(0 ${(-6 * (1 - ease(d))).toFixed(2)})` });
        set(lock, { class: d > 0.5 ? 'rt-locked' : '' });
      };
    },
    people(g, call) {
      const urls = (call.faces && call.faces.length ? call.faces : DEFAULT_FACES).slice(0, 5);
      const n = urls.length, gap = 52, x0 = 150 - (n - 1) * gap / 2;
      const faces = urls.map((u, i) => {
        const c = s('g', { transform: `translate(${x0 + i * gap} 30)` }, g);
        face(c, 0, 0, 17, u);
        const dot = s('circle', { cx: 13, cy: 13, r: 5, class: 'rt-dot' }, c);
        return { c, dot };
      });
      return (p, d) => faces.forEach((f, i) => {
        const k = ease(smooth(i * 0.15, i * 0.15 + 0.35, p) + d);
        set(f.c, { opacity: (0.3 + 0.7 * k).toFixed(2), transform: `translate(${x0 + i * gap} ${(30 + (1 - k) * 5).toFixed(1)})` });
        set(f.dot, { opacity: smooth(0.5, 1, k).toFixed(2) });
      });
    },
    pulse(g, call) {
      // Solo se conocen agregados: aportes contados contra el mínimo y un nivel común. Nunca valores individuales.
      const need = 3;
      const md = s('g', { class: 'rt-mark' }, g);
      const dots = Array.from({ length: need }, (_, i) => s('circle', { cx: 30 + i * 28, cy: 26, r: 10, class: 'rt-slot' }, md));
      s('text', { x: 20, y: 58, class: 'rt-tiny' }, g).textContent = 'Mínimo ' + need;
      const mb = s('g', { class: 'rt-mark' }, g);
      s('rect', { x: 130, y: 18, width: 150, height: 16, rx: 8, class: 'rt-bar' }, mb);
      const fill = s('rect', { x: 130, y: 18, width: 0, height: 16, rx: 8, class: 'rt-bar-on' }, mb);
      s('text', { x: 130, y: 58, class: 'rt-tiny' }, g).textContent = 'Nivel del equipo';
      return (p, d) => {
        dots.forEach((c, i) => set(c, { class: (smooth(i * 0.25, i * 0.25 + 0.2, p) > 0.5 || d > 0) ? 'rt-free' : 'rt-slot' }));
        set(fill, { width: (150 * 0.6 * ease(d)).toFixed(1) });
      };
    },
    stamp(g, call) {
      const ticket = s('rect', { x: 90, y: 32, width: 120, height: 28, rx: 6, class: 'rt-ticket' }, g);
      const mark = s('text', { x: 150, y: 51, class: 'rt-stampmark', 'text-anchor': 'middle', opacity: 0 }, g);
      mark.textContent = 'Una vez';
      const st = s('g', { class: 'rt-mark' }, g);
      s('circle', { cx: 150, cy: -10, r: 6, class: 'rt-stamp-knob' }, st);
      s('rect', { x: 147, y: -6, width: 6, height: 10, rx: 3, class: 'rt-stamp-knob' }, st);
      s('rect', { x: 128, y: 4, width: 44, height: 12, rx: 6, class: 'rt-stamp' }, st);
      return (p, d) => {
        const hover = 2 + 3 * (Math.sin(clamp(p) * Math.PI * 3) * 0.5 + 0.5);
        const y = d > 0 ? hover + 10 * Math.sin(Math.min(1, d * 1.6) * Math.PI) : hover;
        set(st, { transform: `translate(0 ${y.toFixed(1)})` });
        set(mark, { opacity: smooth(0.35, 0.7, d).toFixed(2) });
        set(ticket, { class: d > 0.4 ? 'rt-ticket rt-ticket-on' : 'rt-ticket' });
      };
    },
    intro(g, call) {
      const fu = call.faces && call.faces.length >= 2 ? call.faces : [DEFAULT_FACES[1], DEFAULT_FACES[3]];
      const left = s('g', {}, g), right = s('g', {}, g);
      s('rect', { x: 0, y: 14, width: 84, height: 36, rx: 18, class: 'rt-chip rt-mark' }, left);
      face(left, 18, 32, 12, fu[0]);
      s('rect', { x: 38, y: 28, width: 32, height: 8, rx: 4, class: 'rt-line' }, left);
      s('rect', { x: 0, y: 14, width: 84, height: 36, rx: 18, class: 'rt-chip rt-mark' }, right);
      face(right, 66, 32, 12, fu[1]);
      s('rect', { x: 14, y: 28, width: 32, height: 8, rx: 4, class: 'rt-line' }, right);
      const link = s('line', { x1: 150, y1: 32, x2: 150, y2: 32, class: 'rt-link', opacity: 0 }, g);
      const knot = s('circle', { cx: 150, cy: 32, r: 0, class: 'rt-knot' }, g);
      return (p, d) => {
        const k = ease(p + d);
        set(left, { transform: `translate(${(16 + 26 * k).toFixed(1)} 0)` });
        set(right, { transform: `translate(${(200 - 26 * k).toFixed(1)} 0)` });
        const a = 16 + 26 * k + 84, b = 200 - 26 * k;
        set(link, { x1: a.toFixed(1), x2: b.toFixed(1), opacity: k.toFixed(2) });
        set(knot, { r: (6 * ease(d)).toFixed(2) });
      };
    },
    note(g, call) {
      s('rect', { x: 90, y: 4, width: 120, height: 56, rx: 6, class: 'rt-paper rt-mark' }, g);
      const W = [84, 70, 46];
      const lines = W.map((w, i) => s('rect', { x: 106, y: 18 + i * 13, width: 0, height: 6, rx: 3, class: 'rt-ink' }, g));
      const pin = s('circle', { cx: 198, cy: 14, r: 0, class: 'rt-pin' }, g);
      return (p, d) => {
        lines.forEach((l, i) => set(l, { width: (W[i] * ease(smooth(i * 0.3, i * 0.3 + 0.4, p + d))).toFixed(1) }));
        set(pin, { r: (5 * ease(d)).toFixed(2) });
      };
    },
    invite(g, call) {
      const card = s('g', {}, g);
      const body = s('g', { class: 'rt-mark' }, card);
      s('rect', { x: 0, y: 4, width: 112, height: 54, rx: 6, class: 'rt-paper' }, body);
      s('path', { d: 'M0 10a6 6 0 0 1 6-6h100a6 6 0 0 1 6 6v6H0z', class: 'rt-band' }, body);
      const t = s('text', { x: 56, y: 46, class: 'rt-big', 'text-anchor': 'middle' }, card);
      t.textContent = pick(call.input, ['inicio', 'desde'], '10:30');
      const badge = s('g', { transform: 'translate(108 6)', opacity: 0 }, card);
      s('circle', { r: 10, class: 'rt-badge' }, badge);
      s('path', { d: 'M-4 0l3 3 5-6', class: 'rt-tick' }, badge);
      return (p, d) => {
        const k = ease(p + d);
        set(card, { transform: `translate(${(30 + 64 * k).toFixed(1)} 0)`, opacity: (0.4 + 0.6 * k).toFixed(2) });
        set(badge, { opacity: d.toFixed(2), transform: `translate(108 6) scale(${(0.6 + 0.4 * ease(d)).toFixed(3)})` });
      };
    },
    git(g, call) {
      s('line', { x1: 20, y1: 20, x2: 280, y2: 20, class: 'rt-trunk' }, g);
      const branch = s('path', { d: 'M60 20 C 84 44, 110 44, 130 44 L 200 44 C 224 44, 240 20, 260 20', class: 'rt-branch', 'stroke-dasharray': '260', 'stroke-dashoffset': '260' }, g);
      const commits = [110, 150, 190].map(x => s('circle', { cx: x, cy: 44, r: 0, class: 'rt-commit' }, g));
      const merge = s('circle', { cx: 260, cy: 20, r: 0, class: 'rt-merge' }, g);
      return (p, d) => {
        set(branch, { 'stroke-dashoffset': (260 * (1 - ease(p * 0.85 + d * 0.15))).toFixed(1) });
        commits.forEach((c, i) => set(c, { r: (5 * ease(smooth(0.2 + i * 0.2, 0.35 + i * 0.2, p + d))).toFixed(2) }));
        set(merge, { r: (7 * ease(d)).toFixed(2) });
      };
    },
    granola(g, call) {
      // La grabación se vuelve notas: las ondas bajan y aparecen dos líneas de texto.
      const bars = Array.from({ length: 24 }, (_, i) => s('rect', { x: 32 + i * 10, y: 22, width: 5, height: 0, rx: 2.5, class: 'rt-wave' }, g));
      const lines = [0, 1].map(i => s('rect', { x: 32, y: 44 + i * 11, width: 0, height: 6, rx: 3, class: 'rt-ink' }, g));
      return (p, d) => {
        const T = p * 6;
        bars.forEach((b, i) => { const a = (1 - d) * (6 + 14 * Math.abs(Math.sin(i * 0.9 + T * 5))) * Math.min(1, p * 4) + d * 4; set(b, { y: (24 - a / 2).toFixed(1), height: a.toFixed(1) }); });
        lines.forEach((l, i) => set(l, { width: (ease(d - i * 0.15) * (200 - i * 80)).toFixed(1) }));
      };
    },
    chat(g, call) {
      const marks = s('g', { class: 'rt-mark' }, g);
      const a = s('rect', { x: 40, y: 6, width: 0, height: 22, rx: 11, class: 'rt-bubble-in' }, marks);
      const b = s('rect', { x: 260, y: 34, width: 0, height: 22, rx: 11, class: 'rt-bubble-out' }, marks);
      const ticks = s('path', { d: 'M226 42l3 3 5-6M232 42l3 3 5-6', class: 'rt-ticks', opacity: 0 }, g);
      return (p, d) => {
        const ka = ease(smooth(0, 0.5, p + d)), kb = ease(smooth(0.4, 1, p + d));
        set(a, { width: (130 * ka).toFixed(1) });
        set(b, { width: (110 * kb).toFixed(1), x: (260 - 110 * kb).toFixed(1) });
        set(ticks, { opacity: d.toFixed(2), class: d > 0.5 ? 'rt-ticks rt-ticks-read' : 'rt-ticks' });
      };
    },
    heart(g, call) {
      const path = 'M20 32 H80 L88 32 L96 12 L106 52 L114 26 L122 32 H170 L178 32 L186 14 L196 50 L204 28 L212 32 H280';
      s('path', { d: path, class: 'rt-ecg-ghost' }, g);
      const ecg = s('path', { d: path, class: 'rt-ecg', 'stroke-dasharray': '400', 'stroke-dashoffset': '400' }, g);
      return (p, d) => set(ecg, { 'stroke-dashoffset': (400 * (1 - ease(p * 0.9 + d * 0.1))).toFixed(1) });
    },
    generic(g, call) {
      const bars = [0, 1, 2].map(i => s('rect', { x: 50, y: 14 + i * 14, width: 0, height: 8, rx: 4, class: 'rt-line' }, g));
      return (p, d) => bars.forEach((b, i) => set(b, { width: ((200 - i * 40) * ease(smooth(i * 0.2, i * 0.2 + 0.6, p + d))).toFixed(1) }));
    }
  };

  function create(call) {
    const flavor = flavorOf(call.name), F = FLAVORS[flavor];
    const el = h('article', 'rt-card');
    el.dataset.flavor = flavor;
    el.style.setProperty('--rt-tint', F.tint);

    // Cabeza: tecla, nombre de la acción y, debajo, el conector con su detalle y el recibo.
    const head = h('div', 'rt-head');
    const tile = h('span', 'rt-tile'); tile.setAttribute('aria-hidden', 'true');
    tile.innerHTML = `<svg width="20" height="20" viewBox="0 0 20 20"><path d="${F.glyph}"/></svg>`;
    const meta = h('span', 'rt-meta');
    const more = h('button', 'rt-more');
    more.type = 'button';
    more.setAttribute('aria-expanded', 'false');
    more.setAttribute('aria-label', 'Ver entrada y salida');
    more.innerHTML = '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M4.5 2.5L8 6l-3.5 3.5"/></svg>';
    const status = h('span', 'rt-status');
    const run = h('span', 'rt-run');
    run.innerHTML = '<i class="rt-ico"><svg class="rt-spin" width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="5.5"/><g class="rt-spin-arc"><path d="M7 1.5a5.5 5.5 0 0 1 5.5 5.5"/></g></svg></i>';
    run.append(h('span', '', 'Consultando'));
    const done = h('span', 'rt-done');
    done.innerHTML = call.privateResult
      ? '<i class="rt-ico"><svg width="14" height="14" viewBox="0 0 14 14"><rect x="2.5" y="6" width="9" height="6.5" rx="2"/><path d="M4.8 6V4.3a2.2 2.2 0 0 1 4.4 0V6"/></svg></i>'
      : '<i class="rt-ico"><svg width="14" height="14" viewBox="0 0 14 14"><path class="rt-checkpath" d="M3 7.4l2.6 2.6L11 4.3"/></svg></i>';
    done.append(h('span', '', call.receipt || 'Listo'));
    status.append(run, done);
    meta.append(h('span', 'rt-connector', F.connector), more, status);
    head.append(tile, h('b', 'rt-label', call.label), meta);

    const stage = h('div', 'rt-stage'); stage.setAttribute('aria-hidden', 'true');
    const plate = h('div', 'rt-plate'); stage.append(plate);
    const svg = s('svg', { viewBox: '0 0 300 64', preserveAspectRatio: 'xMidYMid meet' });
    const g = s('g', { class: 'rt-scene' }, svg);
    plate.append(svg);
    const paint = (SCENES[flavor] || SCENES.generic)(g, call);

    // Detalle plegado: nombre técnico, entrada y salida.
    const io = h('div', 'rt-io'); io.hidden = true;
    io.id = 'rt-io-' + (++uid);
    more.setAttribute('aria-controls', io.id);
    const grid = h('div', 'rt-io-grid');
    const outLabel = h('span', 'rt-io-k', 'Salida'), outPre = h('pre', '', pretty(call.output));
    grid.append(h('span', 'rt-io-k', 'Entrada'), h('pre', '', pretty(call.input)), outLabel, outPre);
    io.append(h('code', 'rt-io-name', call.name), grid);
    more.addEventListener('click', () => { const open = io.hidden; io.hidden = !open; more.setAttribute('aria-expanded', String(open)); });

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

  return { create, flavorOf, motionKind, FLAVORS };
})();
