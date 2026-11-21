import { useEffect, useState } from 'react';
import { fetchFace, saveFace, type FaceLook } from './api';
import { Face } from './Face';
import { applyFaceLook, FACE_TONES, lookFromName } from './faceLook';
import { SectionHead } from './SectionHead';

type Choice<Key extends keyof FaceLook> = { value: FaceLook[Key]; label: string };

const KINDS: Choice<'kind'>[] = [
  { value: 'capsula', label: 'Cápsula' },
  { value: 'ovalo', label: 'Óvalo' },
  { value: 'cuenta', label: 'Punto' },
  { value: 'almendra', label: 'Almendra' },
  { value: 'huevo', label: 'Huevo' },
  { value: 'arco', label: 'Arco' },
];
const SIZES: Choice<'size'>[] = [
  { value: 'chica', label: 'Chicos' },
  { value: 'media', label: 'Medianos' },
  { value: 'grande', label: 'Grandes' },
];
const GLASSES: Choice<'glasses'>[] = [
  { value: null, label: 'Sin' },
  { value: 'redondo', label: 'Redondos' },
  { value: 'suave', label: 'Suaves' },
  { value: 'pantos', label: 'Pantos' },
  { value: 'ceja', label: 'Con marco' },
];
const BROWS: Choice<'brow'>[] = [
  { value: null, label: 'Sin' },
  { value: 'plana', label: 'Plana' },
  { value: 'arco', label: 'Curva' },
  { value: 'alzada', label: 'Alzada' },
];
const MARKS: Choice<'mark'>[] = [
  { value: null, label: 'Sin' },
  { value: 'lunar', label: 'Lunar' },
  { value: 'pecas', label: 'Pecas' },
];
const LASHES: Choice<'lashes'>[] = [
  { value: false, label: 'Sin' },
  { value: true, label: 'Con' },
];

interface ChoiceRowProps<Key extends keyof FaceLook> {
  label: string;
  field: Key;
  choices: Choice<Key>[];
  look: FaceLook;
  disabled?: boolean;
  onPick: (changes: Partial<FaceLook>) => void;
}

function ChoiceRow<Key extends keyof FaceLook>({ label, field, choices, look, disabled = false, onPick }: ChoiceRowProps<Key>) {
  return (
    <div className="app-face-row">
      <span className="rd-label">{label}</span>
      <div className="rd-seg rd-seg--wrap" role="group" aria-label={label}>
        {choices.map((choice) => (
          <button
            key={String(choice.value)}
            type="button"
            aria-pressed={look[field] === choice.value}
            disabled={disabled}
            onClick={() => onPick({ [field]: choice.value } as Partial<FaceLook>)}
          >
            {choice.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function FaceEditor({ token, name }: { token: string; name: string }) {
  const [look, setLook] = useState<FaceLook | null>(null);
  const [custom, setCustom] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchFace(token)
      .then(({ face }) => {
        if (!alive) return;
        setLook(face ?? lookFromName(name));
        setCustom(Boolean(face));
      })
      .catch(() => alive && setLook(lookFromName(name)));
    return () => {
      alive = false;
    };
  }, [token, name]);

  const store = (next: FaceLook | null) => {
    setProblem(null);
    applyFaceLook(name, next);
    setLook(next ?? lookFromName(name));
    setCustom(Boolean(next));
    saveFace(token, next).catch(() => setProblem('No se pudo guardar tu cara. Prueba de nuevo.'));
  };
  const pick = (changes: Partial<FaceLook>) => {
    if (!look) return;
    const next = { ...look, ...changes };
    store(next.glasses ? { ...next, brow: null, lashes: false } : next);
  };
  const withGlasses = Boolean(look?.glasses);

  return (
    <div className="app-block">
      <SectionHead
        first
        title="Tu cara"
        end={
          custom ? (
            <button className="rd-button rd-button--quiet rd-button--small" type="button" onClick={() => store(null)}>
              Volver a la original
            </button>
          ) : undefined
        }
      />
      <div className="app-face-editor rd-card rd-glass">
        <div className="app-face-editor__preview">
          <Face name={name} size="hub" />
          <span className="rd-note">Así te ve tu equipo.</span>
        </div>
        {!look ? (
          <p className="rd-note">Cargando…</p>
        ) : (
          <div className="app-face-editor__choices">
            <ChoiceRow label="Ojos" field="kind" choices={KINDS} look={look} onPick={pick} />
            <ChoiceRow label="Tamaño" field="size" choices={SIZES} look={look} onPick={pick} />
            <ChoiceRow label="Anteojos" field="glasses" choices={GLASSES} look={look} onPick={pick} />
            <ChoiceRow label="Ceja" field="brow" choices={BROWS} look={look} disabled={withGlasses} onPick={pick} />
            <ChoiceRow label="Pestañas" field="lashes" choices={LASHES} look={look} disabled={withGlasses} onPick={pick} />
            <ChoiceRow label="Detalle" field="mark" choices={MARKS} look={look} onPick={pick} />
            <div className="app-face-row">
              <span className="rd-label">Luz</span>
              <div className="rd-tones" role="group" aria-label="Luz">
                {Array.from({ length: FACE_TONES }, (_, tone) => (
                  <button
                    key={tone}
                    className="rd-tone"
                    type="button"
                    aria-label={`Luz ${tone + 1}`}
                    aria-pressed={look.tone === tone}
                    style={{ background: window.RondaLuz?.css(window.RondaCaras.paletteFromTone(tone)) }}
                    onClick={() => pick({ tone })}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        {problem && (
          <p className="rd-note" role="alert">
            {problem}
          </p>
        )}
      </div>
    </div>
  );
}
