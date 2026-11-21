import { VISIBILITIES, type Visibility } from './api';

const VISIBILITY_LABEL: Record<Visibility, string> = {
  siempre: 'Se comparte',
  preguntar: 'Te pregunta antes',
  nunca: 'Privado',
};

interface PermissionRowProps {
  name: string;
  statements: string[];
  visibility: Visibility | null;
  disabled: boolean;
  onChange: (visibility: Visibility) => void;
}

export function PermissionRow({ name, statements, visibility, disabled, onChange }: PermissionRowProps) {
  function choose(value: string) {
    const chosen = VISIBILITIES.find((option) => option === value);
    if (chosen) onChange(chosen);
  }

  return (
    <div className="rd-row app-split">
      <div className="app-text app-grow">
        {statements.map((statement, position) => (
          <span className="app-title app-wrap" key={position}>
            {statement}
          </span>
        ))}
      </div>
      {visibility && (
        <select className="rd-input" aria-label={`Permiso para ${name}`} value={visibility} disabled={disabled} onChange={(event) => choose(event.target.value)}>
          {VISIBILITIES.map((option) => (
            <option key={option} value={option}>
              {VISIBILITY_LABEL[option]}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
