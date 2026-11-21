import { useEffect, useState } from 'react';
import { fetchProfile, saveProfile } from './api';
import { Glyph } from './Glyph';
import { Item } from './Item';
import { ItemIcon } from './ItemIcon';
import { RowButton } from './RowButton';
import { TextForm } from './TextForm';

const MAX_GOAL_LENGTH = 120;

export function GoalSection({ token }: { token: string }) {
  const [goal, setGoal] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    void fetchProfile(token).then(
      (profile) => setGoal(profile.goal),
      () => undefined,
    );
  }, [token]);

  const save = async (text: string) => {
    setGoal((await saveProfile(token, { goal: text })).goal);
    setEditing(false);
  };

  if (goal && !editing)
    return (
      <div className="rd-list">
        <Item
          icon={
            <ItemIcon>
              <Glyph name="goal" />
            </ItemIcon>
          }
          title={goal}
          subtitle="Tu meta personal"
          end={<RowButton label="Cambiar" name="Cambiar tu meta personal" onClick={() => setEditing(true)} />}
        />
      </div>
    );

  return <TextForm label="Tu meta personal" placeholder="Tu meta personal: dormir 7 horas, entrenar 3 veces…" action="Guardar" maxLength={MAX_GOAL_LENGTH} onSubmit={save} />;
}
