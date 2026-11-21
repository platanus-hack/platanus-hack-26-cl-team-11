import type { Signals, Summary } from './api';
import { Face } from './Face';
import { GoalSection } from './GoalSection';
import { SummarySection } from './SummarySection';

interface YouTabProps {
  token: string;
  name: string;
  signals: Signals | null;
  summary: Summary | null;
}

const MAX_BULLETS = 3;
const FALLBACK_LINE = 'Conecta una fuente y aquí aparece cómo vienes.';

export function YouTab({ token, name, signals, summary }: YouTabProps) {
  const lines = summary?.lines.slice(0, MAX_BULLETS) ?? [];

  return (
    <div className="app-block">
      <div className="app-you">
        <Face name={name} size="hub" state={signals?.energy.level === 'alta' ? 'lista' : 'reposo'} />
        <div className="app-text">
          <h1 className="rd-title">{name}</h1>
          {lines.length === 0 && <p className="app-lead">{FALLBACK_LINE}</p>}
          {lines.length > 0 && (
            <ul className="app-bullets">
              {lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {signals && summary && <SummarySection signals={signals} summary={summary} />}
      <GoalSection token={token} />
      <p className="rd-note">Esto lo ves solo tú.</p>
    </div>
  );
}
