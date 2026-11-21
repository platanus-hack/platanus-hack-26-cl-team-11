import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { fetchInvite, joinInvite, type InviteSummary } from './api';
import { countOf, messageOf } from './format';
import { readSavedPerson, savePerson } from './savedPerson';
import { useAction } from './useAction';

const MAX_NAME_LENGTH = 80;

export function InvitePage({ code }: { code: string }) {
  const [invite, setInvite] = useState<InviteSummary | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [name, setName] = useState('');
  const saved = useMemo(readSavedPerson, []);
  const { busy, error, run } = useAction();

  useEffect(() => {
    fetchInvite(code).then(setInvite, (failure: unknown) => setProblem(messageOf(failure, 'No se pudo abrir la invitación.')));
  }, [code]);

  const enter = (who: { name: string } | { token: string }) =>
    void run(async () => {
      const joined = await joinInvite(code, who);
      savePerson({ token: joined.token, name: joined.name });
      window.location.assign(`/conectar/${encodeURIComponent(joined.token)}#equipo`);
    });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (name.trim()) enter({ name: name.trim() });
  }

  return (
    <>
      <h1 className="rd-hero">
        Te invitaron
        <br />
        <span className="rd-gradient-text">a un equipo.</span>
      </h1>
      {problem && <p className="rd-note">{problem}</p>}
      {invite && (
        <section className="rd-card rd-glass">
          <span className="rd-label">
            {invite.team} · {countOf(invite.people, 'persona', 'personas')}
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
        </section>
      )}
    </>
  );
}
