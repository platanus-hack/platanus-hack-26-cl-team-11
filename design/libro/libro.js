/* La landing «Por qué Montu»: monta las caras del equipo, enciende el globo y marca la sección abierta. */
(function () {
  'use strict';
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.querySelectorAll('[data-face]').forEach(function (node) {
    window.RondaCaras.mount(node, node.dataset.face, { size: node.clientWidth || 64 });
  });

  // El globo aprobado, incrustado: cada acuerdo entre agentes suma a la cuenta.
  var globe = document.getElementById('globe'), count = document.getElementById('globe-count'), talks = 0;
  var narrow = window.matchMedia('(max-width: 900px)').matches;
  globe.src = '../grafo/globo.html?embed&marco=' + (narrow ? 300 : 330) + '&ancho=' + (narrow ? 300 : 420) + (reduced ? '&still' : '');
  window.addEventListener('message', function (event) {
    var data = event.data;
    if (event.source !== globe.contentWindow || !data || data.ronda !== 'globo' || data.type !== 'acuerdo') return;
    talks += Number(data.conversaciones) || 0;
    count.textContent = talks.toLocaleString('es-CL');
  });

  // La pestaña de la sección que se está leyendo queda en tinta.
  var tabs = Array.from(document.querySelectorAll('.rd-nav a'));
  var mark = function (id) {
    tabs.forEach(function (tab) {
      if (tab.getAttribute('href') === '#' + id) tab.setAttribute('aria-current', 'true'); else tab.removeAttribute('aria-current');
    });
  };
  if ('IntersectionObserver' in window) {
    var watcher = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { if (entry.isIntersecting) mark(entry.target.id); });
    }, { rootMargin: '-35% 0px -60% 0px' });
    document.querySelectorAll('.ld-section[id]').forEach(function (section) { watcher.observe(section); });
  }
})();
