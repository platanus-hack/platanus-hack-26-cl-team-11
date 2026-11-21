import type { Signals, Visibility } from './api';

const VISIBILITY_LABEL: Record<Visibility, string> = {
  siempre: 'Se comparte',
  preguntar: 'Te pregunta antes',
  nunca: 'Privado',
};

function SignalRow({ statement, visibility }: { statement: string; visibility: Visibility }) {
  return (
    <div className="rd-row">
      <span className="app-title">{statement}</span>
      <span className="rd-chip rd-glass">{VISIBILITY_LABEL[visibility]}</span>
    </div>
  );
}

export function SignalsCard({ signals }: { signals: Signals }) {
  return (
    <section className="rd-card rd-glass">
      <span className="rd-label">Lo que tu agente entiende de ti</span>
      <SignalRow statement={signals.energy.statement} visibility={signals.energy.visibility} />
      <SignalRow statement={signals.load.statement} visibility={signals.load.visibility} />
      {signals.blockers.map((blocker) => (
        <SignalRow key={`${blocker.topic}-${blocker.since}`} statement={blocker.statement} visibility={blocker.visibility} />
      ))}
      {signals.expertise.length > 0 && (
        <SignalRow statement={`Sabe de ${signals.expertise.slice(0, 4).join(', ')}`} visibility={signals.visibility.expertise} />
      )}
      <p className="rd-note">Tus datos crudos no salen de aquí. Lo que puede salir son estas frases.</p>
    </section>
  );
}
