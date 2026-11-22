(function () {
  'use strict';
  var query = new URLSearchParams(location.search);
  var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches || query.has('still');
  var byId = function (id) { return document.getElementById(id); };
  var format = function (n) { return n.toLocaleString('es-CL'); };
  var pairsOf = function (n) { return n * (n - 1) / 2; };
  var token = function (name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); };

  var SMALL = 5;
  var LARGE = 300;
  var GOLDEN_ANGLE = 2.39996323;
  var COUNT_MS = 1400;

  var net = byId('net');
  var pen = net.getContext('2d');
  var drawing = 0;
  var people = 0;

  function drawNet(n, instant) {
    var run = ++drawing;
    var box = net.getBoundingClientRect();
    var ratio = Math.min(window.devicePixelRatio || 1, 2);
    people = n;
    if (!box.width || !box.height || !pen) return;
    net.width = box.width * ratio;
    net.height = box.height * ratio;
    pen.setTransform(ratio, 0, 0, ratio, 0, 0);
    var few = n <= 12;
    var radius = Math.min(box.width, box.height) * 0.42;
    var points = [];
    for (var k = 0; k < n; k++) {
      var reach = few ? radius * 0.86 : radius * Math.sqrt((k + 0.5) / n);
      var angle = few ? -Math.PI / 2 + (k / n) * Math.PI * 2 : k * GOLDEN_ANGLE;
      points.push([box.width / 2 + reach * Math.cos(angle), box.height / 2 + reach * Math.sin(angle)]);
    }
    var ink = token('--rd-ink');
    var tint = token('--rd-g3');
    var total = pairsOf(n);
    var batch = Math.ceil(total / (few ? 30 : 80));
    var done = 0;
    var i = 0;
    var j = 1;
    var dots = function () {
      pen.globalAlpha = 1;
      pen.fillStyle = ink;
      points.forEach(function (point) {
        pen.beginPath();
        pen.arc(point[0], point[1], few ? 12 : 2.4, 0, Math.PI * 2);
        pen.fill();
      });
    };
    var frame = function () {
      if (run !== drawing) return;
      var upto = Math.min(total, done + batch);
      pen.globalAlpha = few ? 0.55 : 0.045;
      pen.strokeStyle = few ? ink : tint;
      pen.lineWidth = few ? 2.5 : 0.5;
      pen.beginPath();
      while (done < upto) {
        pen.moveTo(points[i][0], points[i][1]);
        pen.lineTo(points[j][0], points[j][1]);
        done += 1;
        j += 1;
        if (j === n) { i += 1; j = i + 1; }
      }
      pen.stroke();
      if (done >= total) dots();
      else if (instant) frame();
      else requestAnimationFrame(frame);
    };
    if (few) dots();
    frame();
  }

  var counting = 0;
  function countTo(target, instant) {
    var run = ++counting;
    var node = byId('count');
    var from = Number(node.dataset.value || target);
    node.dataset.value = String(target);
    if (instant || from === target) { node.textContent = format(target); return; }
    var start = performance.now();
    var frame = function (now) {
      if (run !== counting) return;
      var progress = Math.min(1, (now - start) / COUNT_MS);
      var eased = 1 - Math.pow(1 - progress, 4);
      node.textContent = format(Math.round(from + (target - from) * eased));
      if (progress < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  function showScale(step, instant) {
    var n = step >= 2 ? LARGE : SMALL;
    byId('people').textContent = format(n) + ' personas';
    countTo(pairsOf(n), instant);
    if (n !== people) drawNet(n, instant);
  }

  var slides = Array.from(document.querySelectorAll('.pb-slide'));
  var scale = slides.indexOf(document.querySelector('.pb-scale'));
  var current = -1;
  var stepAt = 1;
  var stepsOf = function (index) { return Number(slides[index].dataset.steps || 1); };

  function go(index, step) {
    index = Math.max(0, Math.min(slides.length - 1, index));
    step = Math.max(1, Math.min(stepsOf(index), step || 1));
    var entering = index !== current;
    if (entering) {
      slides.forEach(function (slide, at) {
        slide.toggleAttribute('data-on', at === index);
        slide.setAttribute('aria-hidden', String(at !== index));
      });
      if (current === scale) { drawing += 1; people = 0; }
      current = index;
    }
    stepAt = step;
    if (index === scale) showScale(step, still || (entering && step === 1 ? false : still));
    history.replaceState(null, '', '?s=' + index + (step > 1 ? '&k=' + step : '') + (query.has('still') ? '&still' : ''));
  }

  var forward = function () { if (stepAt < stepsOf(current)) go(current, stepAt + 1); else go(current + 1, 1); };
  var back = function () { if (stepAt > 1) go(current, stepAt - 1); else if (current > 0) go(current - 1, stepsOf(current - 1)); };

  byId('deck').addEventListener('click', forward);
  document.addEventListener('keydown', function (event) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    var key = event.key;
    if (key === 'ArrowRight' || key === 'PageDown' || key === ' ' || key === 'Enter') { event.preventDefault(); forward(); }
    else if (key === 'ArrowLeft' || key === 'PageUp') { event.preventDefault(); back(); }
    else if (key === 'f' || key === 'F') { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(function () {}); }
    else if (key === 'Home') go(0, 1);
    else if (key === 'End') go(slides.length - 1, 1);
  });
  window.addEventListener('message', function (event) {
    var data = event.data;
    if (event.origin !== window.location.origin || !data || data.montu !== 'deck') return;
    if (data.key === 'ArrowRight' || data.key === 'PageDown') forward();
    else if (data.key === 'ArrowLeft' || data.key === 'PageUp') back();
  });
  window.addEventListener('resize', function () { if (current === scale) drawNet(people || SMALL, true); });

  fetch('qr.svg').then(function (response) { return response.text(); }).then(function (svg) { document.querySelector('.pb-qr').innerHTML = svg; }).catch(function () {});

  var presenter = null;
  try { presenter = JSON.parse(window.localStorage.getItem('ronda.persona') || 'null'); } catch (failure) { presenter = null; }
  byId('stage').src = presenter && typeof presenter.token === 'string' ? '/conectar/' + encodeURIComponent(presenter.token) + '?vivo&escenario#globo' : '/';

  go(Number(query.get('s')) || 0, Number(query.get('k')) || 1);
})();
