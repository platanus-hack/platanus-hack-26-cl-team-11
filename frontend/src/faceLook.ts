import type { FaceLook, FaceSizeChoice } from './api';

export const FACE_SIZE_VALUES: Record<FaceSizeChoice, number> = { chica: 4.2, media: 5.2, grande: 6.4 };
export const FACE_TONES = 11;

export function applyFaceLook(name: string, look: FaceLook | null): void {
  if (!look) {
    window.RondaCaras.customize(name);
    return;
  }
  window.RondaCaras.customize(name, {
    recipe: { kind: look.kind, a: FACE_SIZE_VALUES[look.size], glasses: look.glasses, brow: look.brow, mark: look.mark, lashes: look.lashes },
    palette: window.RondaCaras.paletteFromTone(look.tone),
  });
}

function nearestSize(a: number): FaceSizeChoice {
  const sizes = Object.entries(FACE_SIZE_VALUES) as [FaceSizeChoice, number][];
  return sizes.reduce((best, current) => (Math.abs(current[1] - a) < Math.abs(best[1] - a) ? current : best))[0];
}

export function lookFromName(name: string): FaceLook {
  const caras = window.RondaCaras;
  const key = caras.keyFor(name);
  const recipe = caras.TEAM[key] ?? caras.recipeFor(key);
  const tone = caras.lightFor(name).palette[0] ?? 0;
  return {
    kind: recipe.kind as FaceLook['kind'],
    size: nearestSize(recipe.a),
    glasses: recipe.glasses as FaceLook['glasses'],
    brow: recipe.brow as FaceLook['brow'],
    mark: recipe.mark as FaceLook['mark'],
    lashes: recipe.lashes,
    tone: tone < FACE_TONES ? tone : 0,
  };
}
