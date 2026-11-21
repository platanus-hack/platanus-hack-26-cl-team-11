interface RowButtonProps {
  label: string;
  name?: string;
  expanded?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export function RowButton({ label, name, expanded, disabled = false, onClick }: RowButtonProps) {
  return (
    <button className="rd-button rd-button--quiet rd-button--small" type="button" aria-label={name} aria-expanded={expanded} disabled={disabled} onClick={onClick}>
      {label}
    </button>
  );
}
