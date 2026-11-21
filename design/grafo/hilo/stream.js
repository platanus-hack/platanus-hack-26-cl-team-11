// Ronda · streaming de mensajes y deslizamiento del feed.
// Sigue la regla Stream de Stageshow: cada palabra se pone desde el inicio en su lugar final,
// oculta, así el globo de texto nunca se reacomoda mientras llega. update() solo enciende palabras.
window.RondaStream = (() => {
  const PRIVATE = '[[x]]';

  function create(text) {
    const el = document.createElement('span');
    el.className = 'rs-stream';
    const words = [];
    const parts = text.split(/(\s+)/u);
    for (const part of parts) {
      if (!part) continue;
      if (/^\s+$/u.test(part)) { el.append(document.createTextNode(' ')); continue; }
      const w = document.createElement('span');
      w.className = 'rs-word';
      if (part.startsWith(PRIVATE)) {
        w.classList.add('rs-private');
        w.innerHTML = '<svg width="10" height="12" viewBox="0 0 10 12" aria-hidden="true"><rect x="1" y="5" width="8" height="6" rx="1.6"/><path d="M3 5V3.6a2 2 0 0 1 4 0V5"/></svg>';
        w.append(document.createTextNode('dato privado'));
        const rest = part.slice(PRIVATE.length);
        if (rest) { el.append(w); const tail = document.createElement('span'); tail.className = 'rs-word'; tail.textContent = rest; words.push(w, tail); el.append(tail); continue; }
      } else w.textContent = part;
      words.push(w);
      el.append(w);
    }
    const caret = document.createElement('span');
    caret.className = 'rs-caret';
    caret.setAttribute('aria-hidden', 'true');
    el.append(caret);
    let shown = -1;
    return {
      el,
      count: words.length,
      // fraction 0..1 de la escritura; done deja el cursor apagado.
      update(fraction, done) {
        const n = Math.max(0, Math.min(words.length, Math.ceil(fraction * words.length)));
        if (n !== shown) {
          for (let i = 0; i < words.length; i++) {
            const on = i < n;
            if (on !== words[i].hasAttribute('data-on')) words[i].toggleAttribute('data-on', on);
          }
          shown = n;
          const last = words[Math.max(0, n - 1)];
          if (last && caret.previousSibling !== last) last.after(caret);
        }
        el.toggleAttribute('data-writing', !done && n > 0);
        return true;
      },
      // Para movimiento reducido o el estado final quieto.
      finish() { words.forEach(w => w.setAttribute('data-on', '')); el.removeAttribute('data-writing'); shown = words.length; }
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
      n.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 520, easing: 'cubic-bezier(0.45, 0, 0.1, 1)' });
    });
    el.animate([
      { opacity: 0, transform: 'translateY(-6px) scale(0.985)' },
      { opacity: 1, transform: 'none' }
    ], { duration: 820, easing: 'cubic-bezier(0.25, 0.8, 0.25, 1)' });
    return el;
  }

  return { create, append };
})();
