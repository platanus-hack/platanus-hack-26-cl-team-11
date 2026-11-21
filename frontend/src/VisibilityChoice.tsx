import { VISIBILITIES, type Visibility } from './api';
import { VISIBILITY_LABEL } from './signalGroups';

interface VisibilityChoiceProps {
  label: string;
  value: Visibility;
  disabled: boolean;
  onChange: (visibility: Visibility) => void;
}

export function VisibilityChoice({ label, value, disabled, onChange }: VisibilityChoiceProps) {
  return (
    <div className="rd-actions" role="group" aria-label={label}>
      {VISIBILITIES.map((option) => (
        <button
          key={option}
          type="button"
          className={`rd-button rd-button--quiet rd-button--small${option === value ? '' : ' app-off'}`}
          aria-pressed={option === value}
          disabled={disabled}
          onClick={() => onChange(option)}
        >
          {VISIBILITY_LABEL[option]}
        </button>
      ))}
    </div>
  );
}
