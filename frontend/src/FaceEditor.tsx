import { useEffect, useState } from 'react';
import { fetchFace, saveFace, type FaceLook } from './api';
import { Face } from './Face';
import { applyFaceLook, FACE_TONES, facePalette, lookFromName, paletteFromLook, recipeFromLook } from './faceLook';
import { SectionHead } from './SectionHead';

type Field = Exclude<keyof FaceLook, 'tone'>;
type Option = { value: FaceLook[Field]; label: string };
type Group = { field: Field; label: string; options: Option[] };
type Category = { id: string; label: string; groups: Group[]; tones?: boolean };

const EYES: Category = {
  id: 'ojos',
  label: 'Ojos',
  groups: [
    {
      field: 'kind',
      label: 'Forma',
      options: [
        { value: 'capsula', label: 'Cápsula' },
        { value: 'ovalo', label: 'Óvalo' },
        { value: 'cuenta', label: 'Punto' },
        { value: 'almendra', label: 'Almendra' },
        { value: 'huevo', label: 'Huevo' },
        { value: 'arco', label: 'Arco' },
        { value: 'gota', label: 'Gota' },
        { value: 'media', label: 'Media luna' },
        { value: 'cuadrada', label: 'Cuadrados' },
      ],
    },
  ],
};

const CATEGORIES: Category[] = [
  EYES,
  {
    id: 'forma',
    label: 'Tamaño',
    groups: [
      {
        field: 'size',
        label: 'Tamaño',
        options: [
          { value: 'chica', label: 'Chicos' },
          { value: 'media', label: 'Medianos' },
          { value: 'grande', label: 'Grandes' },
        ],
      },
      {
        field: 'spacing',
        label: 'Distancia',
        options: [
          { value: 'juntos', label: 'Juntos' },
          { value: 'normal', label: 'Normal' },
          { value: 'separados', label: 'Separados' },
        ],
      },
    ],
  },
  {
    id: 'mirada',
    label: 'Mirada',
    groups: [
      {
        field: 'lid',
        label: 'Párpados',
        options: [
          { value: 'despiertos', label: 'Despiertos' },
          { value: 'tranquilos', label: 'Tranquilos' },
          { value: 'sueno', label: 'Con sueño' },
        ],
      },
      {
        field: 'tilt',
        label: 'Inclinación',
        options: [
          { value: 'rectos', label: 'Rectos' },
          { value: 'arriba', label: 'Hacia arriba' },
          { value: 'abajo', label: 'Hacia abajo' },
        ],
      },
    ],
  },
  {
    id: 'anteojos',
    label: 'Anteojos',
    groups: [
      {
        field: 'glasses',
        label: 'Anteojos',
        options: [
          { value: null, label: 'Sin' },
          { value: 'redondo', label: 'Redondos' },
          { value: 'suave', label: 'Suaves' },
          { value: 'pantos', label: 'Pantos' },
          { value: 'ceja', label: 'Con marco' },
        ],
      },
    ],
  },
  {
    id: 'detalles',
    label: 'Detalles',
    groups: [
      {
        field: 'brow',
        label: 'Ceja',
        options: [
          { value: null, label: 'Sin' },
          { value: 'plana', label: 'Plana' },
          { value: 'arco', label: 'Curva' },
          { value: 'alzada', label: 'Alzada' },
        ],
      },
      {
        field: 'lashes',
        label: 'Pestañas',
        options: [
          { value: false, label: 'Sin' },
          { value: true, label: 'Con' },
        ],
      },
      {
        field: 'mark',
        label: 'Marca',
        options: [
          { value: null, label: 'Sin' },
          { value: 'lunar', label: 'Lunar' },
          { value: 'pecas', label: 'Pecas' },
        ],
      },
    ],
  },
  {
    id: 'color',
    label: 'Color',
    tones: true,
    groups: [
      {
        field: 'mix',
        label: 'Mezcla',
        options: [
          { value: 'armonica', label: 'Armónica' },
          { value: 'contraste', label: 'Contraste' },
          { value: 'unico', label: 'Un tono' },
        ],
      },
    ],
  },
];

const BLOCKED_BY_GLASSES: Field[] = ['brow', 'lashes'];

function settle(look: FaceLook): FaceLook {
  return look.glasses ? { ...look, brow: null, lashes: false } : look;
}

export function FaceEditor({ token, name }: { token: string; name: string }) {
  const [look, setLook] = useState<FaceLook | null>(null);
  const [custom, setCustom] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState(EYES.id);
  const category = CATEGORIES.find((item) => item.id === categoryId) ?? EYES;

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
  const pick = (changes: Partial<FaceLook>) => look && store(settle({ ...look, ...changes }));

  return (
    <div className="app-block">
      <SectionHead
        first
        title="Tu agente"
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
            <div className="rd-seg rd-seg--wrap" role="group" aria-label="Qué cambiar">
              {CATEGORIES.map((item) => (
                <button key={item.id} type="button" aria-pressed={item.id === category.id} onClick={() => setCategoryId(item.id)}>
                  {item.label}
                </button>
              ))}
            </div>
            {category.tones && (
              <div className="app-face-editor__group">
                <span className="rd-label">Luz</span>
                <div className="rd-tones" role="group" aria-label="Luz">
                  {Array.from({ length: FACE_TONES }, (_, tone) => (
                    <button
                      key={tone}
                      className="rd-tone"
                      type="button"
                      aria-label={`Luz ${tone + 1}`}
                      aria-pressed={look.tone === tone}
                      style={{ background: window.RondaLuz?.css(facePalette(tone, look.mix)) }}
                      onClick={() => pick({ tone })}
                    />
                  ))}
                </div>
              </div>
            )}
            {category.groups.map((group) => (
              <div key={group.field} className="app-face-editor__group">
                {category.groups.length > 1 || category.tones ? <span className="rd-label">{group.label}</span> : null}
                <div className="rd-picks" role="group" aria-label={group.label}>
                  {group.options.map((option) => {
                    const variant = settle({ ...look, [group.field]: option.value } as FaceLook);
                    return (
                      <button
                        key={String(option.value)}
                        className="rd-pick"
                        type="button"
                        aria-pressed={look[group.field] === option.value}
                        disabled={Boolean(look.glasses) && BLOCKED_BY_GLASSES.includes(group.field)}
                        onClick={() => pick({ [group.field]: option.value } as Partial<FaceLook>)}
                      >
                        <Face name={name} size="pick" recipe={recipeFromLook(variant)} palette={paletteFromLook(variant)} />
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
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
