import { useState } from 'react';
import { createTeam, joinTeam } from './api';
import { Glyph } from './Glyph';
import { Item } from './Item';
import { ItemIcon } from './ItemIcon';
import { RowButton } from './RowButton';
import { SectionHead } from './SectionHead';
import { TextForm } from './TextForm';

const MAX_NAME_LENGTH = 80;
const MAX_CODE_LENGTH = 64;

type Step = 'create' | 'join';

export function TeamStart({ token, onChange }: { token: string; onChange: () => Promise<void> }) {
  const [step, setStep] = useState<Step | null>(null);
  const toggle = (next: Step) => setStep((current) => (current === next ? null : next));

  async function create(name: string) {
    await createTeam(token, name);
    await onChange();
  }

  async function join(joinCode: string) {
    await joinTeam(token, joinCode);
    await onChange();
  }

  return (
    <div className="app-block">
      <SectionHead first title="Equipo" />
      <p className="rd-note">Todavía no estás en un equipo.</p>
      <div className="rd-list">
        <div>
          <Item
            icon={
              <ItemIcon>
                <Glyph name="plus" />
              </ItemIcon>
            }
            title="Crear un equipo"
            subtitle="Tú eliges el nombre"
            end={<RowButton label="Crear" name="Crear un equipo" expanded={step === 'create'} onClick={() => toggle('create')} />}
          />
          {step === 'create' && (
            <div className="rd-item__detail">
              <TextForm label="Nombre del equipo" placeholder="Nombre del equipo" action="Crear equipo" maxLength={MAX_NAME_LENGTH} onSubmit={create} />
            </div>
          )}
        </div>
        <div>
          <Item
            icon={
              <ItemIcon>
                <Glyph name="key" />
              </ItemIcon>
            }
            title="Entrar a un equipo"
            subtitle="Con el código que te compartieron"
            end={<RowButton label="Entrar" name="Entrar a un equipo" expanded={step === 'join'} onClick={() => toggle('join')} />}
          />
          {step === 'join' && (
            <div className="rd-item__detail">
              <TextForm label="Código del equipo" placeholder="Código del equipo" action="Pedir entrar" maxLength={MAX_CODE_LENGTH} onSubmit={join} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
