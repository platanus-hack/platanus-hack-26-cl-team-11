import { useCallback, useState } from 'react';
import { Face } from './Face';
import { Item } from './Item';
import { QrCode } from './QrCode';
import { ASSISTANT_NAME, fetchRoomState, type RoomPerson, type RoomState } from './roomApi';
import { usePolling } from './usePolling';

const REFRESH_MS = 2000;
const PROTOCOL = /^https?:\/\//;

const assistantsOf = (person: RoomPerson) => (person.assistants.length > 0 ? person.assistants.map((kind) => ASSISTANT_NAME[kind]).join(', ') : 'Sin agente todavía');

export function RoomPage({ code }: { code: string }) {
  const [state, setState] = useState<RoomState | null>(null);
  const load = useCallback(async () => setState(await fetchRoomState(code)), [code]);
  const { error } = usePolling(load, REFRESH_MS);

  if (!state) return <main className="app-main">{error ? <h1 className="rd-title">{error}</h1> : <p className="rd-note">Cargando…</p>}</main>;

  const joinUrl = `${window.location.origin}/unirse/${state.code}`;
  const withAssistant = state.people.filter((person) => person.assistants.length > 0).length;

  return (
    <div className="rd-layout">
      <section className="rd-stack">
        <h1 className="rd-hero">
          {state.name}
          <br />
          <span className="rd-gradient-text">entra con tu agente.</span>
        </h1>
        {state.people.length === 0 && <p className="rd-note">Todavía no entra nadie.</p>}
        <div className="rd-list">
          {state.people.map((person) => (
            <Item
              key={person.id}
              icon={<Face name={person.name} />}
              title={
                <>
                  {person.name}
                  {person.assistants.length > 0 && <span className="rd-dot" />}
                </>
              }
              subtitle={assistantsOf(person)}
            />
          ))}
        </div>
      </section>
      <aside className="rd-stack">
        <section className="rd-card rd-glass">
          <span className="rd-label">Escanea para entrar</span>
          <QrCode text={joinUrl} label={`Código para entrar a ${state.name}`} />
          <span className="rd-code">{joinUrl.replace(PROTOCOL, '')}</span>
        </section>
        <section className="rd-card rd-card--split rd-glass">
          <div>
            <span className="rd-label">Personas</span>
            <span className="rd-stat">{state.people.length}</span>
          </div>
          <div>
            <span className="rd-label">Con agente</span>
            <span className="rd-stat">{withAssistant}</span>
          </div>
        </section>
      </aside>
    </div>
  );
}
