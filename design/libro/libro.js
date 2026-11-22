/* El libro: reparte el texto en páginas (las columnas de .lb-flow) y las pasa.
   De a dos páginas en pantallas anchas y de a una en el teléfono. La tapa va sola, a la derecha. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var book = $('book'), view = $('view'), flow = $('flow');
  var chapters = Array.from(flow.querySelectorAll('[id]')).filter(function (node) { return node.parentNode === flow; });
  var tabs = Array.from(document.querySelectorAll('.rd-nav a'));
  var two = true, width = 0, total = 1, at = 0;

  // Caras vivas de la tapa.
  document.querySelectorAll('[data-face]').forEach(function (node) {
    window.RondaCaras.mount(node, node.dataset.face, { size: node.clientWidth || 56 });
  });

  // En qué página empieza un elemento: cada página mide `width` dentro del flujo.
  function pageOf(node) {
    return Math.max(0, Math.floor((node.getBoundingClientRect().left - flow.getBoundingClientRect().left + 2) / width));
  }
  // La tapa es la página 0. De a dos, se ve la `at - 1` a la izquierda y la `at` a la derecha.
  function last() { return two ? total - 1 + ((total - 1) % 2) : total - 1; }
  function show(page, instant) {
    at = Math.max(0, Math.min(last(), two ? page + (page % 2) : page));
    if (instant) flow.style.transition = 'none';
    flow.style.transform = 'translateX(' + -((two ? at - 1 : at) * width) + 'px)';
    if (instant) { void flow.offsetWidth; flow.style.transition = ''; }
    book.toggleAttribute('data-cover', at === 0);
    $('sheet-left').hidden = two && at === 0;
    $('sheet-right').hidden = at > total - 1;
    $('prev').disabled = at === 0;
    $('next').disabled = at >= last();
    var pages = total - 1;
    $('where').textContent = at === 0 ? 'Portada'
      : two ? (at > pages ? 'Página ' + (at - 1) : 'Páginas ' + (at - 1) + ' y ' + at) + ' de ' + pages
      : 'Página ' + at + ' de ' + pages;
    var open = chapters.filter(function (node) { return pageOf(node) <= at; }).pop();
    tabs.forEach(function (tab) {
      if (open && tab.getAttribute('href') === '#' + open.id) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
    });
  }
  function measure() {
    var keep = chapters.filter(function (node) { return width && pageOf(node) <= at; }).pop();
    two = getComputedStyle(book).getPropertyValue('--pages').trim() === '2';
    width = view.clientWidth / (two ? 2 : 1);
    total = Math.max(1, Math.round((flow.scrollWidth + parseFloat(getComputedStyle(view).paddingLeft) * 2) / width));
    show(keep ? pageOf(keep) : at, true);
  }
  var step = function (dir) { show(at + dir * (two ? 2 : 1)); };

  $('next').addEventListener('click', function () { step(1); });
  $('prev').addEventListener('click', function () { step(-1); });
  $('edge-next').addEventListener('click', function () { step(1); });
  $('edge-prev').addEventListener('click', function () { step(-1); });
  document.addEventListener('keydown', function (event) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === 'ArrowRight' || event.key === 'PageDown' || (event.key === ' ' && !event.shiftKey && event.target === book)) { event.preventDefault(); step(1); }
    else if (event.key === 'ArrowLeft' || event.key === 'PageUp') { event.preventDefault(); step(-1); }
    else if (event.key === 'Home') show(0);
    else if (event.key === 'End') show(last());
  });
  // Los enlaces del índice y de la barra abren la página de su capítulo.
  document.addEventListener('click', function (event) {
    var link = event.target.closest('a[href^="#"]');
    var target = link && document.getElementById(link.getAttribute('href').slice(1));
    if (!target || !flow.contains(target)) return;
    event.preventDefault();
    show(pageOf(target));
  });
  // En el teléfono se pasa la página deslizando.
  var from = null;
  view.addEventListener('pointerdown', function (event) { from = event.pointerType === 'mouse' ? null : event.clientX; });
  view.addEventListener('pointerup', function (event) {
    if (from === null) return;
    var moved = event.clientX - from;
    from = null;
    if (Math.abs(moved) > 48) step(moved < 0 ? 1 : -1);
  });
  // El foco del teclado no puede quedar en una página que no se ve.
  flow.addEventListener('focusin', function (event) {
    var page = pageOf(event.target);
    if (page > at || page < (two ? at - 1 : at)) show(page);
    view.scrollLeft = 0;
  });

  window.addEventListener('resize', measure);
  window.addEventListener('beforeprint', function () { flow.style.transform = ''; });
  window.addEventListener('afterprint', measure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  measure();
})();
