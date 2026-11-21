import { useEffect, useRef, useState } from 'react';
import '../../design/luz/luz.js';
import '../../design/faces/caras.js';

export type FaceState = 'reposo' | 'activa' | 'pensando' | 'lista' | 'ausente';
export type FaceSize = 'row' | 'node' | 'hub' | 'tab';

interface MountedFace {
  set(state: FaceState): MountedFace;
  destroy(): void;
}

export interface FaceRecipe {
  kind: string;
  a: number;
  glasses: string | null;
  brow: string | null;
  mark: string | null;
  lashes: boolean;
  gap: number;
  lid: number;
  tilt: number;
}

declare global {
  interface Window {
    RondaCaras: {
      mount(node: HTMLElement, name: string, options: { trigger?: Element }): MountedFace;
      customize(name: string, look?: { recipe?: Partial<FaceRecipe>; palette?: number[] }): void;
      keyFor(name: string): string;
      recipeFor(name: string): FaceRecipe;
      lightFor(name: string): { palette: number[] };
      paletteFromTone(tone: number, mix?: string): number[];
      TEAM: Record<string, FaceRecipe>;
    };
    RondaLuz?: { css(palette: number[]): string };
  }
}

export const FACE_CHANGED = 'rondacaras:cambio';

const ROW_SELECTOR = 'a, button';

function useFaceVersion(name: string): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const key = window.RondaCaras.keyFor(name);
    const onChange = (event: Event) => {
      if ((event as CustomEvent<{ key: string }>).detail?.key === key) setVersion((value) => value + 1);
    };
    window.addEventListener(FACE_CHANGED, onChange);
    return () => window.removeEventListener(FACE_CHANGED, onChange);
  }, [name]);
  return version;
}

interface FaceProps {
  name: string;
  state?: FaceState;
  size?: FaceSize;
}

export function Face({ name, state = 'reposo', size = 'row' }: FaceProps) {
  const host = useRef<HTMLSpanElement>(null);
  const face = useRef<MountedFace | null>(null);
  const version = useFaceVersion(name);

  useEffect(() => {
    const node = host.current;
    if (!node) return;
    const mounted = window.RondaCaras.mount(node, name, { trigger: node.closest(ROW_SELECTOR) ?? undefined });
    face.current = mounted;
    return () => {
      face.current = null;
      mounted.destroy();
    };
  }, [name, size, version]);

  useEffect(() => {
    face.current?.set(state);
  }, [name, size, state, version]);

  return <span ref={host} className={`app-face app-face--${size}`} aria-hidden="true" />;
}
