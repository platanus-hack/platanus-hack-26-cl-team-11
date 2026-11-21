import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { countOf, messageOf } from './format';
import { fetchRoom, joinRoom, type RoomSummary } from './roomApi';
import { readSavedPerson, savePerson } from './savedPerson';
import { useAction } from './useAction';

const MAX_NAME_LENGTH = 80;

export function JoinPage({ code }: { code: string }) {
  const [room, setRoom] = useState<RoomSummary | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [name, setName] = useState('');
  const saved = useMemo(readSavedPerson, []);
  const { busy, error, run } = useAction();

  useEffect(() => {
    fetchRoom(code).then(setRoom, (failure: unknown) => setProblem(messageOf(failure, 'No se pudo abrir la sala.')));
  }, [code]);

  const enter = (who: { name: string } | { token: string }) =>
    void run(async () => {
      const joined = await joinRoom(code, who);
      savePerson({ token: joined.token, name: joined.name });
      window.location.assign(`/conectar/${encodeURIComponent(joined.token)}#agente`);
    });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (name.trim()) enter({ name: name.trim() });
  }

  return (
    <>
      <h1 className="rd-hero">
        Entra a la ronda
        <br />
        <span className="rd-gradient-text">con tu agente.</span>
      </h1>
      {problem && <p className="rd-note">{problem}</p>}
      {room && (
        <section className="rd-card rd-glass">
          <span className="rd-label">
            {room.name} · {countOf(room.people, 'persona', 'personas')}
          </span>
          <form className="rd-actions" onSubmit={submit}>
            <input
              className="rd-input app-grow"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Tu nombre"
              aria-label="Tu nombre"
              maxLength={MAX_NAME_LENGTH}
              autoComplete="name"
            />
            <button className="rd-button" type="submit" disabled={busy || !name.trim()}>
              {busy ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
          {saved && (
            <div className="rd-actions">
              <button className="rd-button rd-button--quiet" type="button" disabled={busy} onClick={() => enter({ token: saved.token })}>
                Seguir como {saved.name}
              </button>
            </div>
          )}
          {error && (
            <p className="rd-note" role="alert">
              {error}
            </p>
          )}
          <p className="rd-note">Después conectas el agente que ya usas. Tú decides qué comparte.</p>
        </section>
      )}
    </>
  );
}
