import { useEffect, useRef } from 'react';
import '../../design/grafo/hilo/stream.css';
import '../../design/grafo/hilo/stream.js';

interface Stream {
  el: HTMLElement;
  update(fraction: number, done: boolean): boolean;
  finish(): void;
}

declare global {
  interface Window {
    RondaStream: { create(text: string): Stream };
  }
}

const MS_PER_LETTER = 22;
const MIN_MS = 900;
const MAX_MS = 5200;

export function StreamText({ text, play, onDone }: { text: string; play: boolean; onDone?: () => void }) {
  const host = useRef<HTMLSpanElement>(null);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    const node = host.current;
    if (!node) return;
    const stream = window.RondaStream.create(text);
    node.replaceChildren(stream.el);
    if (!play || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      stream.finish();
      if (play) done.current?.();
      return;
    }
    const duration = Math.min(MAX_MS, Math.max(MIN_MS, text.length * MS_PER_LETTER));
    const startedAt = performance.now();
    let frame = requestAnimationFrame(function step(now: number) {
      const fraction = Math.min(1, (now - startedAt) / duration);
      stream.update(fraction, fraction >= 1);
      if (fraction < 1) frame = requestAnimationFrame(step);
      else done.current?.();
    });
    return () => cancelAnimationFrame(frame);
  }, [text, play]);

  return <span ref={host} />;
}
