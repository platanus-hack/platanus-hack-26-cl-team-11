import React, { useLayoutEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { Stage } from "../../../.agents/skills/stageshow/kit/stage";
import { Bubble, Thread } from "../../../.agents/skills/stageshow/kit/messages";
import { createPlayback, createFrameDriver } from "../../../.agents/skills/stageshow/playground/playback";

const footer = document.querySelector(".rd-player");
const duration = Number(footer.dataset.duration);
const slug = footer.dataset.scene;
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const template = document.querySelector("#illustration");
const toggle = document.querySelector("#toggle");
const reset = document.querySelector("#restart");
const progress = document.querySelector(".rd-player__position span");
const readout = document.querySelector(".rd-player__time");
const clockText = ms => "0:" + String(Math.floor(ms / 1000)).padStart(2, "0");
const clamp = n => Math.max(0, Math.min(1, n));
const ease = n => n * n * (3 - 2 * n);
const span = (t, start, end) => clamp((t - start) / (end - start));
const dimensions = {
  chat: [420, 340], calendars: [540, 500], health: [428, 516],
  permission: [476, 554], help: [440, 428],
};
const beats = {
  chat: [[0, "agentes"], [1800, "pregunta"], [6500, "respuesta"], [9400, "conversacion"]],
  calendars: [[0, "agendas"], [4400, "coincidencia"], [7400, "propuesta"]],
  health: [[0, "lectura"], [3450, "consulta"], [6700, "respuesta"], [8500, "privado"]],
  permission: [[0, "consulta"], [4900, "permiso"], [6230, "envio"], [8400, "recepcion"]],
  help: [[0, "pedido"], [2050, "oferta"], [4100, "primer-si"], [7000, "segundo-si"], [8650, "presentacion"]],
};

let time = reduced.matches ? duration : 0;
let playing = !reduced.matches;
let stageAct = null;
let lastMark = "";
let paintScene = () => {};

function controls() {
  const label = playing ? "Pausar" : (time === duration ? "Reproducir" : "Continuar");
  document.querySelector("#toggleText").textContent = label;
  document.querySelector("#playIcon").hidden = playing;
  document.querySelector("#pauseIcon").hidden = !playing;
  footer.dataset.state = playing ? "playing" : time === duration ? "ended" : "paused";
}

function draw() {
  paintScene(time);
  const mark = beats[slug].filter(([at]) => at <= time).at(-1)[1];
  if (mark !== lastMark && stageAct) {
    stageAct.mark(mark);
    lastMark = mark;
  }
  progress.style.transform = "scaleX(" + time / duration + ")";
  const stamp = clockText(time) + " / " + clockText(duration);
  if (readout.textContent !== stamp) readout.textContent = stamp;
}

// This transport uses Stageshow's elapsed-time driver. All paths, bubbles and
// control states are derived from one time, so pause freezes even a handoff.
function advance(ms) {
  time = Math.min(duration, time + ms / (window.__stageshow?.slow || 1));
  draw();
  if (time === duration) setPlaying(false);
}
const playback = createPlayback({
  fps: 60, advance, step: () => advance(1000 / 60), flushLayout: () => {},
}, {
  now: () => performance.now(), hidden: () => document.hidden,
  onFrame: () => {}, onError: err => { setPlaying(false); console.error(err); },
});
const driver = createFrameDriver({
  running: () => playback.isPlaying(),
  request: cb => requestAnimationFrame(cb), cancel: id => cancelAnimationFrame(id),
  tick: ts => playback.tick(ts),
});
function setPlaying(value) {
  playing = value;
  playback.set({playing});
  controls();
  driver.sync();
}
function replay() {
  time = 0;
  lastMark = "";
  draw();
  setPlaying(true);
}
toggle.onclick = () => time === duration ? replay() : setPlaying(!playing);
reset.onclick = replay;
document.addEventListener("keydown", event => {
  if (event.code === "Space" && !event.repeat && event.target === document.body) {
    event.preventDefault();
    toggle.click();
  }
});
reduced.addEventListener("change", () => {
  if (reduced.matches) {
    time = duration;
    draw();
    setPlaying(false);
  }
});
document.addEventListener("visibilitychange", () => { playback.set({}); driver.sync(); });

function painter(root) {
  const arrivals = [...root.querySelectorAll("[data-at]")].map(el => [el, Number(el.dataset.at)]);
  const handoffs = [...root.querySelectorAll("[data-transit]")].map(el => [el, el.dataset.transit.split(",").map(Number)]);
  const packets = [...root.querySelectorAll("[data-flight]")].map(el => {
    const svg = el.parentElement.querySelector("svg");
    const path = svg.querySelector("#route");
    return {el, svg, path, length: path.getTotalLength(), range: el.dataset.flight.split(",").map(Number)};
  });
  const trace = root.querySelector("[data-draw]");
  const stroke = trace?.dataset.draw.split(",").map(Number);
  const button = root.querySelector("[data-press]");
  const tap = root.querySelector("[data-tap]");
  const lit = root.querySelector("#lit");
  return t => {
    const still = reduced.matches;
    for (const [el, start] of arrivals) {
      const p = start === 0 ? 1 : span(t, start, start + (still ? 1 : 540));
      el.style.opacity = p;
      el.style.visibility = p ? "visible" : "hidden";
      el.style.transform = still || p === 1 || el.closest(".health .exchange-text, .answer") ? "none" : "translateY(" + (1 - ease(p)) * 9 + "px)";
    }
    for (const [el, [out, back]] of handoffs) {
      if (!still && t >= out - 240 && t <= back + 240) {
        el.style.opacity = t < out ? 1 - span(t, out - 240, out) : span(t, back, back + 240);
      }
    }
    let activity = 0;
    for (const {el, svg, path, length, range: [start, end]} of packets) {
      const p = span(t, start, end);
      const opacity = Math.min(span(t, start, start + 240), 1 - span(t, end - 240, end));
      activity = Math.max(activity, opacity);
      el.style.visibility = !still && opacity ? "visible" : "hidden";
      if (opacity && !still) {
        const distance = ease(el.hasAttribute("data-reverse") ? 1 - p : p);
        const point = path.getPointAtLength(length * distance);
        const x = svg.clientWidth * point.x / svg.viewBox.baseVal.width;
        const y = svg.clientHeight * point.y / svg.viewBox.baseVal.height;
        el.style.transform = "translate3d(" + x + "px," + y + "px,0)";
        el.style.opacity = opacity;
      }
    }
    if (lit) lit.style.opacity = activity;
    if (trace) trace.style.strokeDashoffset = 1 - (still ? Number(t >= stroke[0]) : span(t, ...stroke));
    if (button) {
      const p = span(t, +button.dataset.press, +button.dataset.press + 650);
      const confirm = span(t, +button.dataset.press + 400, +button.dataset.press + 740);
      const [before, after] = button.children;
      before.style.opacity = clamp(1 - 2 * confirm);
      after.style.opacity = clamp(2 * confirm - 1);
      before.style.visibility = confirm < .5 ? "visible" : "hidden";
      after.style.visibility = confirm >= .5 ? "visible" : "hidden";
      button.style.backgroundColor = "color-mix(in srgb, var(--rd-fill-soft) " + 100 * confirm + "%, var(--rd-ink))";
      button.style.color = "color-mix(in srgb, var(--rd-ink) " + 100 * confirm + "%, var(--rd-on-ink))";
      const press = Math.sin(Math.PI * p);
      button.style.transform = still ? "none" : "scale(" + (1 - .04 * press) + ")";
      tap.style.opacity = still ? 0 : press;
      tap.style.transform = "scale(" + (.5 + p * .9) + ")";
    }
  };
}

async function script(act) {
  stageAct = act;
  lastMark = "";
  draw();
  // Stage owns the named beats; the presenter transport owns elapsed time.
  // Finish the once script on its settled frame, including after a replay.
  while (time < duration) await act.wait(250);
}

function Illustration() {
  const content = useRef(null);
  useLayoutEffect(() => {
    const root = content.current;
    root.replaceChildren(template.content.cloneNode(true));
    const threads = [...root.querySelectorAll("[data-thread]")].map(target => {
      const message = target.textContent;
      const thread = createRoot(target);
      thread.render(<Thread app="chat"><Bubble from="me">{message}</Bubble></Thread>);
      return thread;
    });
    paintScene = painter(root);
    draw();
    return () => { paintScene = () => {}; queueMicrotask(() => threads.forEach(thread => thread.unmount())); };
  }, []);
  return <div className="composition" ref={content}/>;
}

const [wide, narrow] = dimensions[slug];
createRoot(document.querySelector("#example")).render(
  <Stage width={700} height={wide} compact={{below: 525, width: 358, height: narrow}}
    play="once" script={script} initial={{}} poster={{}} className="ronda-stage">
    {() => <Illustration/>}
  </Stage>
);
const observer = new IntersectionObserver(([entry]) => {
  playback.set({ visible: entry.isIntersecting, playing });
  driver.sync();
});
observer.observe(document.querySelector("#example"));
controls();
