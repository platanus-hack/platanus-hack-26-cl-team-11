interface PulseStatProps {
  label: string;
  value: string | null;
  unit?: string;
  note: string;
}

export function PulseStat({ label, value, unit, note }: PulseStatProps) {
  return (
    <div>
      <span className="rd-label">{label}</span>
      {value !== null && (
        <span className="rd-stat">
          {value}
          {unit && <span className="rd-stat__unit">{unit}</span>}
        </span>
      )}
      <span className="rd-note">{note}</span>
    </div>
  );
}
