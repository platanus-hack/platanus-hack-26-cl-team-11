import type { FaceLook } from './api';

export const FACE_TONES = 15;

const SIZES = { chica: 4.2, media: 5.2, grande: 6.4 } satisfies Record<FaceLook['size'], number>;
const SPACINGS = { juntos: 11.6, normal: 13.6, separados: 16 } satisfies Record<FaceLook['spacing'], number>;
const LIDS = { despiertos: 0, tranquilos: 0.22, sueno: 0.34 } satisfies Record<FaceLook['lid'], number>;
const TILTS = { rectos: 0, arriba: 4, abajo: -4 } satisfies Record<FaceLook['tilt'], number>;

export const facePalette = (tone: number, mix: FaceLook['mix']) => window.RondaCaras.paletteFromTone(tone, mix);

export function applyFaceLook(name: string, look: FaceLook | null): void {
  if (!look) {
    window.RondaCaras.customize(name);
    return;
  }
  window.RondaCaras.customize(name, {
    recipe: {
      kind: look.kind,
      a: SIZES[look.size],
      gap: SPACINGS[look.spacing] ?? SPACINGS.normal,
      lid: LIDS[look.lid] ?? LIDS.despiertos,
      tilt: TILTS[look.tilt] ?? TILTS.rectos,
      glasses: look.glasses,
      brow: look.brow,
      mark: look.mark,
      lashes: look.lashes,
    },
    palette: facePalette(look.tone, look.mix ?? 'armonica'),
  });
}

function nearest<Key extends string>(values: Record<Key, number>, target: number): Key {
  const entries = Object.entries(values) as [Key, number][];
  return entries.reduce((best, current) => (Math.abs(current[1] - target) < Math.abs(best[1] - target) ? current : best))[0];
}

export function lookFromName(name: string): FaceLook {
  const caras = window.RondaCaras;
  const key = caras.keyFor(name);
  const recipe = caras.TEAM[key] ?? caras.recipeFor(key);
  const tone = caras.lightFor(name).palette[0] ?? 0;
  return {
    kind: recipe.kind as FaceLook['kind'],
    size: nearest(SIZES, recipe.a),
    glasses: recipe.glasses as FaceLook['glasses'],
    brow: recipe.brow as FaceLook['brow'],
    mark: recipe.mark as FaceLook['mark'],
    lashes: recipe.lashes,
    spacing: nearest(SPACINGS, recipe.gap),
    lid: nearest(LIDS, recipe.lid),
    tilt: nearest(TILTS, recipe.tilt),
    tone: tone < FACE_TONES ? tone : 0,
    mix: 'armonica',
  };
}
