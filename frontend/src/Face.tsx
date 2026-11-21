import { useEffect, useRef } from 'react';
import '../../design/luz/luz.js';
import '../../design/faces/caras.js';

export type FaceState = 'reposo' | 'activa' | 'pensando' | 'lista' | 'ausente';
export type FaceSize = 'row' | 'node' | 'hub';

interface MountedFace {
  set(state: FaceState): MountedFace;
  destroy(): void;
}

declare global {
  interface Window {
    RondaCaras: { mount(node: HTMLElement, name: string, options: { trigger?: Element }): MountedFace };
  }
}

const ROW_SELECTOR = 'a, button';

interface FaceProps {
  name: string;
  state?: FaceState;
  size?: FaceSize;
}

export function Face({ name, state = 'reposo', size = 'row' }: FaceProps) {
  const host = useRef<HTMLSpanElement>(null);
  const face = useRef<MountedFace | null>(null);

  useEffect(() => {
    const node = host.current;
    if (!node) return;
    const mounted = window.RondaCaras.mount(node, name, { trigger: node.closest(ROW_SELECTOR) ?? undefined });
    face.current = mounted;
    return () => {
      face.current = null;
      mounted.destroy();
    };
  }, [name, size]);

  useEffect(() => {
    face.current?.set(state);
  }, [name, size, state]);

  return <span ref={host} className={`app-face app-face--${size}`} aria-hidden="true" />;
}
