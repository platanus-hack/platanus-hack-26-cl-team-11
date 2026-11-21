import { useCallback, useMemo, useState } from 'react';
import { Face } from './Face';
import { countOf } from './format';
import { Item } from './Item';
import { QrCode } from './QrCode';
import { ASSISTANT_NAME, fetchRoomState, simulateRoom, type RoomPerson, type RoomState } from './roomApi';
import { RoomThreadRow } from './RoomThreadRow';
import { RowButton } from './RowButton';
import { SectionHead } from './SectionHead';
import { useAction } from './useAction';
import { usePolling } from './usePolling';

const REFRESH_MS = 2000;
const PEOPLE_SHOWN = 12;
const SIMULATED_PEOPLE = 30;
const PROTOCOL = /^https?:\/\//;

function describe(person: RoomPerson) {
  if (person.synthetic) return 'Persona simulada';
  return person.assistants.length > 0 ? person.assistants.map((kind) => ASSISTANT_NAME[kind]).join(', ') : 'Sin agente todavía';
}

export function RoomPage({ code }: { code: string }) {
  const [state, setState] = useState<RoomState | null>(null);
  const [openThread, setOpenThread] = useState<string | null>(null);
  const load = useCallback(async () => setState(await fetchRoomState(code)), [code]);
  const { error, refresh } = usePolling(load, REFRESH_MS);
  const { busy, error: simulationError, run } = useAction();
  const people = useMemo(() => new Map((state?.people ?? []).map((person) => [person.id, person])), [state]);

  if (!state) return <main className="app-main">{error ? <h1 className="rd-title">{error}</h1> : <p className="rd-note">Cargando…</p>}</main>;

  const joinUrl = `${window.location.origin}/unirse/${state.code}`;
  const withAssistant = state.people.filter((person) => person.assistants.length > 0).length;
  const hidden = state.people.length - PEOPLE_SHOWN;
  const talking = state.round?.status === 'en_curso';
  const simulate = () =>
    void run(async () => {
      await simulateRoom(state.code, SIMULATED_PEOPLE);
      await refresh();
    });

  return (
    <div className="rd-layout">
      <section className="rd-stack">
        <h1 className="rd-hero">
          {state.name}
          <br />
          <span className="rd-gradient-text">entra con tu agente.</span>
        </h1>
        {state.threads.length > 0 && (
          <div className="app-block">
            <SectionHead title="Agentes conversando" end={talking ? <span className="rd-chip rd-glass">En curso</span> : undefined} />
            <div className="rd-list">
              {state.threads.map((thread) => (
                <RoomThreadRow
                  key={thread.id}
                  thread={thread}
                  people={people}
                  open={openThread === thread.id}
                  onToggle={() => setOpenThread((current) => (current === thread.id ? null : thread.id))}
                />
              ))}
            </div>
            <p className="rd-note">De las personas reales se ve quién le escribe a quién y el tema. El texto solo lo leen ellas.</p>
          </div>
        )}
        <div className="app-block">
          <SectionHead title="En la sala" />
          {state.people.length === 0 && <p className="rd-note">Todavía no entra nadie.</p>}
          <div className="rd-list">
            {state.people.slice(0, PEOPLE_SHOWN).map((person) => (
              <Item
                key={person.id}
                icon={<Face name={person.name} />}
                title={
                  <>
                    {person.name}
                    {person.assistants.length > 0 && <span className="rd-dot" />}
                  </>
                }
                subtitle={describe(person)}
              />
            ))}
          </div>
          {hidden > 0 && <p className="rd-note">Y {countOf(hidden, 'persona más', 'personas más')}.</p>}
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
        <div className="rd-actions">
          <a className="rd-button rd-button--quiet app-link" href={`/design/grafo/sala.html?sala=${encodeURIComponent(state.code)}`}>
            Ver la sala en el globo
          </a>
        </div>
        <section className="rd-card rd-glass">
          <span className="rd-label">Simulación</span>
          <p className="rd-note">Suma {SIMULATED_PEOPLE} personas inventadas, cada una con su repo, y sus agentes conversan.</p>
          <div className="rd-actions">
            <RowButton label={busy ? 'Inventando…' : `Simular ${SIMULATED_PEOPLE} personas`} disabled={busy || talking} onClick={simulate} />
          </div>
          {simulationError && (
            <p className="rd-note" role="alert">
              {simulationError}
            </p>
          )}
        </section>
      </aside>
    </div>
  );
}
