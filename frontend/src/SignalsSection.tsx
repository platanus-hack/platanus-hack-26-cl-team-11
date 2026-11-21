import { useState } from 'react';
import type { SignalKey, Signals, Source } from './api';
import { SectionHead } from './SectionHead';
import { SIGNAL_GROUPS } from './signalGroups';
import { SignalRow } from './SignalRow';

export function SignalsSection({ signals, sources }: { signals: Signals; sources: Source[] }) {
  const [openKey, setOpenKey] = useState<SignalKey | null>(null);
  const sourceLabels = new Map(sources.map((source) => [source.id, source.label]));

  return (
    <div className="app-block">
      <SectionHead title="Lo que tu agente entiende de ti" />
      <div className="rd-list">
        {SIGNAL_GROUPS.map((group) => (
          <SignalRow
            key={group.key}
            group={group}
            signals={signals}
            sourceLabels={sourceLabels}
            open={openKey === group.key}
            onToggle={() => setOpenKey((current) => (current === group.key ? null : group.key))}
          />
        ))}
      </div>
      <p className="rd-note">Tus datos crudos no salen de aquí. Lo que puede salir son estas frases, según el permiso que elijas.</p>
    </div>
  );
}
