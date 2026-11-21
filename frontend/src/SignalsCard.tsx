import { useEffect, useState } from 'react';
import { fetchPolicy, updatePolicy, type Policy, type SignalKey, type Signals } from './api';
import { messageOf } from './format';
import { PermissionRow } from './PermissionRow';
import { useAction } from './useAction';

const MAX_TOPICS_SHOWN = 4;

interface SignalGroup {
  key: SignalKey;
  name: string;
  statements: string[];
}

const groupsOf = (signals: Signals): SignalGroup[] => [
  { key: 'energy', name: 'tu energía', statements: [signals.energy.statement] },
  { key: 'load', name: 'tu carga', statements: [signals.load.statement] },
  {
    key: 'blockers',
    name: 'tus bloqueos',
    statements: signals.blockers.length > 0 ? signals.blockers.map((blocker) => blocker.statement) : ['Sin bloqueos abiertos'],
  },
  {
    key: 'expertise',
    name: 'tus temas de trabajo',
    statements: [signals.expertise.length > 0 ? `Sabe de ${signals.expertise.slice(0, MAX_TOPICS_SHOWN).join(', ')}` : 'Sin temas de trabajo todavía'],
  },
];

export function SignalsCard({ token, signals }: { token: string; signals: Signals }) {
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { busy, error, run } = useAction();

  useEffect(() => {
    let current = true;
    fetchPolicy(token)
      .then((loaded) => {
        if (!current) return;
        setPolicy(loaded);
        setLoadError(null);
      })
      .catch((failure: unknown) => {
        if (current) setLoadError(messageOf(failure, 'No se pudieron cargar tus permisos.'));
      });
    return () => {
      current = false;
    };
  }, [token]);

  const change = (changes: Partial<Policy>) => void run(async () => setPolicy(await updatePolicy(token, changes)));
  const problem = error ?? loadError;

  return (
    <section className="rd-card rd-glass">
      <span className="rd-label">Lo que tu agente entiende de ti</span>
      {groupsOf(signals).map((group) => (
        <PermissionRow
          key={group.key}
          name={group.name}
          statements={group.statements}
          visibility={policy ? policy[group.key] : null}
          disabled={busy}
          onChange={(visibility) => change({ [group.key]: visibility })}
        />
      ))}
      {policy && (
        <label className="rd-note app-check">
          <input type="checkbox" checked={policy.includeInPulse} disabled={busy} onChange={(event) => change({ includeInPulse: event.target.checked })} />
          <span>Participar en el pulso del equipo</span>
        </label>
      )}
      {problem && (
        <p className="rd-note" role="alert">
          {problem}
        </p>
      )}
      <p className="rd-note">Tus datos crudos no salen de aquí. Lo que puede salir son estas frases, según el permiso que elijas.</p>
      <p className="rd-note">El pulso muestra solo el nivel del grupo, nunca tu nombre. Lo que dejes en «Privado» tampoco entra al pulso.</p>
    </section>
  );
}
