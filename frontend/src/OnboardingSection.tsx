import type { OnboardingStep, OnboardingStepId } from './api';
import { Glyph, type GlyphName } from './Glyph';
import { Item } from './Item';
import { ItemIcon } from './ItemIcon';
import { RowButton } from './RowButton';
import { SectionHead } from './SectionHead';
import type { TabId } from './tabs';

interface StepCopy {
  title: string;
  verb: string;
  glyph: GlyphName;
  tab: TabId;
}

export const ONBOARDING_STEPS: Record<OnboardingStepId, StepCopy> = {
  equipo: { title: 'Entra a tu equipo', verb: 'Entrar', glyph: 'team', tab: 'equipo' },
  agente: { title: 'Conecta tu agente', verb: 'Conectar', glyph: 'agent', tab: 'ajustes' },
  checkin: { title: 'Cuenta cómo llegas hoy', verb: 'Contar', glyph: 'person', tab: 'ajustes' },
  whatsapp: { title: 'Conecta WhatsApp', verb: 'Conectar', glyph: 'chat', tab: 'tu' },
  salud: { title: 'Manda tus datos de salud', verb: 'Enviar', glyph: 'energy', tab: 'ajustes' },
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
              off={step.done}
              end={step.done ? undefined : <RowButton label={copy.verb} name={copy.title} onClick={() => onOpen(step.id)} />}
            />
          );
        })}
      </div>
    </div>
  );
}
