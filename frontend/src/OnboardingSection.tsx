import type { OnboardingStep, OnboardingStepId } from './api';
import { Glyph, type GlyphName } from './Glyph';
import { Item } from './Item';
import { ItemIcon } from './ItemIcon';
import { RowButton } from './RowButton';
import { SectionHead } from './SectionHead';
import type { TabId } from './tabs';

interface StepCopy {
  title: string;
  pending: string;
  done: string;
  verb: string;
  glyph: GlyphName;
  tab: TabId;
}

export const ONBOARDING_STEPS: Record<OnboardingStepId, StepCopy> = {
  equipo: { title: 'Entra a tu equipo', pending: 'Con el código que te pasaron, o crea uno', done: 'Ya estás en un equipo', verb: 'Entrar', glyph: 'team', tab: 'equipo' },
  agente: { title: 'Conecta tu agente', pending: 'Le cuenta a Ronda en qué trabajas y qué necesitas', done: 'Tu agente ya está conectado', verb: 'Conectar', glyph: 'agent', tab: 'agente' },
  checkin: { title: 'Cuenta cómo llegas hoy', pending: 'Tu check-in toma medio minuto', done: 'Ya hiciste tu check-in', verb: 'Contar', glyph: 'person', tab: 'ajustes' },
  whatsapp: { title: 'Conecta WhatsApp', pending: 'Para hablar con tu agente desde el teléfono', done: 'Tu WhatsApp ya está conectado', verb: 'Conectar', glyph: 'chat', tab: 'ajustes' },
  salud: { title: 'Manda tus datos de salud', pending: 'Sueño y pasos desde tu iPhone, con un toque', done: 'Ya llegaron tus datos de salud', verb: 'Enviar', glyph: 'energy', tab: 'fuentes' },
};

interface OnboardingSectionProps {
  steps: OnboardingStep[];
  onOpen: (step: OnboardingStepId) => void;
}

export function OnboardingSection({ steps, onOpen }: OnboardingSectionProps) {
  const finished = steps.filter((step) => step.done).length;
  if (finished === steps.length) return null;

  return (
    <div className="app-block">
      <SectionHead title="Primeros pasos" end={<span className="rd-chip rd-glass">{`${finished} de ${steps.length}`}</span>} />
      <div className="rd-list">
        {steps.map((step) => {
          const copy = ONBOARDING_STEPS[step.id];
          return (
            <Item
              key={step.id}
              icon={
                <ItemIcon>
                  <Glyph name={step.done ? 'check' : copy.glyph} />
                </ItemIcon>
              }
              title={copy.title}
              subtitle={step.done ? copy.done : copy.pending}
              off={step.done}
              end={step.done ? undefined : <RowButton label={copy.verb} name={copy.title} onClick={() => onOpen(step.id)} />}
            />
          );
        })}
      </div>
    </div>
  );
}
