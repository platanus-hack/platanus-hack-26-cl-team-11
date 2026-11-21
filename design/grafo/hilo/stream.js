// Montu · streaming de mensajes y deslizamiento del feed.
// Regla Stream de Stageshow: cada letra está desde el inicio en su lugar final, invisible, así el
// globo de texto nunca se reacomoda. update() mueve una «cabeza» continua por el texto y las letras
// se encienden con una cola suave de opacidad (sin palabras que saltan ni cursor que parpadea).
// El ritmo no es lineal: pausa breve tras coma y punto, ráfagas cortas como un modelo de verdad.
window.RondaStream = (() => {
  const PRIVATE = '[[x]]';
  const TAIL = 7; // letras en la cola de encendido

  function create(text) {
    const el = document.createElement('span');
    el.className = 'rs-stream';
    const glyphs = [];   // { node, w } en orden de aparición
    const push = (node, w) => { glyphs.push({ node, w }); };
    const parts = text.split(/(\s+)/u);
    for (const part of parts) {
      if (!part) continue;
      if (/^\s+$/u.test(part)) { const s = document.createElement('span'); s.className = 'rs-ch'; s.textContent = ' '; el.append(s); push(s, 0.6); continue; }
      const word = document.createElement('span');
      word.className = 'rs-word';
      let rest = part;
      if (part.startsWith(PRIVATE)) {
        const pill = document.createElement('span');
        pill.className = 'rs-ch rs-private';
        pill.innerHTML = '<svg width="10" height="12" viewBox="0 0 10 12" aria-hidden="true"><rect x="1" y="5" width="8" height="6" rx="1.6"/><path d="M3 5V3.6a2 2 0 0 1 4 0V5"/></svg>';
        pill.append(document.createTextNode('dato privado'));
        word.append(pill); push(pill, 5);
        rest = part.slice(PRIVATE.length);
      }
      for (const ch of rest) {
        const c = document.createElement('span'); c.className = 'rs-ch'; c.textContent = ch; word.append(c);
        push(c, /[.!?…]/u.test(ch) ? 7 : /[,;:]/u.test(ch) ? 4 : 1);
      }
      el.append(word);
    }
    // Ritmo: tiempo acumulado por letra, normalizado a 0..1, con ráfagas suaves cada pocas letras.
    let acc = 0;
    const at = glyphs.map((g, i) => { const t = acc; acc += g.w * (0.75 + 0.5 * ((Math.sin(i * 1.7) + 1) / 2)); return t; });
    const total = acc || 1;
    const N = glyphs.length;
    const vis = new Float32Array(N);
    const label = text.replace(/\[\[x\]\]/g, 'dato privado');
    el.setAttribute('aria-label', label);

    function headFor(fraction) {
      const target = Math.max(0, Math.min(1, fraction)) * total;
      let lo = 0, hi = N;
      while (lo < hi) { const m = (lo + hi) >> 1; if (at[m] <= target) lo = m + 1; else hi = m; }
      if (lo >= N) return N + TAIL;
      const prev = lo ? at[lo - 1] : 0, span = Math.max(1e-6, at[lo] - prev);
      return lo + Math.min(1, (target - prev) / span);
    }
    function paint(head) {
      for (let i = 0; i < N; i++) {
        const v = Math.round(Math.max(0, Math.min(1, (head - i) / TAIL)) * 50) / 50;
        if (v === vis[i]) continue;
        vis[i] = v;
        glyphs[i].node.style.opacity = v >= 1 ? '' : v.toFixed(3);
      }
    }
    glyphs.forEach(g => { g.node.style.opacity = '0'; });

    return {
      el,
      count: N,
      // fraction 0..1 del mensaje; done lo deja completo.
      update(fraction, done) {
        paint(done ? N + TAIL : headFor(fraction) * (1 + TAIL / Math.max(1, N)));
        el.toggleAttribute('data-writing', !done && fraction > 0 && fraction < 1);
        return true;
      },
      finish() { paint(N + TAIL); el.removeAttribute('data-writing'); }
    };
  }

  // Agrega un elemento al feed y desliza los anteriores hacia arriba (FLIP), sin saltos.
  function append(feed, el) {
    const items = [...feed.children];
    const before = items.map(n => n.getBoundingClientRect().top);
    feed.append(el);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return el;
    items.forEach((n, i) => {
      const dy = before[i] - n.getBoundingClientRect().top;
      if (!dy) return;
      n.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 560, easing: 'cubic-bezier(0.32, 0.72, 0, 1)' });
    });
    el.animate([
      { opacity: 0, transform: 'translateY(14px) scale(0.97)', filter: 'blur(6px)' },
      { opacity: 1, transform: 'none', filter: 'blur(0)' }
    ], { duration: 620, easing: 'cubic-bezier(0.32, 0.72, 0, 1)' });
    return el;
  }

  return { create, append };
})();
