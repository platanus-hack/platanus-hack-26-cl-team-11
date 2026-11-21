import { useState, type FormEvent } from 'react';
import { createPerson, type CreatedPerson } from './api';
import { RoomStart } from './RoomStart';

export function HomePage() {
  const [name, setName] = useState('');
  const [created, setCreated] = useState<CreatedPerson | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      setCreated(await createPerson(name.trim()));
      setName('');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo crear.');
    } finally {
      setSending(false);
    }
  }

  const link = created ? `${window.location.origin}/conectar/${created.token}` : null;

  return (
    <>
      <h1 className="rd-hero">
        Tu agente,
        <br />
        <span className="rd-gradient-text">con tu señal.</span>
      </h1>
      <section className="rd-card rd-glass">
        <span className="rd-label">Nueva persona</span>
        <form className="rd-actions" onSubmit={submit}>
          <input
            className="rd-input app-grow"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nombre"
            aria-label="Nombre"
            maxLength={80}
          />
          <button className="rd-button" type="submit" disabled={sending || !name.trim()}>
            Crear link
          </button>
        </form>
        {error && <p className="rd-note">{error}</p>}
      </section>
      {created && link && (
        <section className="rd-card rd-glass">
          <span className="rd-label">Link de {created.name}</span>
          <a className="rd-code" href={link}>
            {link}
          </a>
          <p className="rd-note">Es personal. Quien lo tenga puede ver sus registros.</p>
          <a className="rd-button rd-button--quiet app-link" href={`/contexto/${encodeURIComponent(created.token)}`}>
            Ver su mapa de contexto
          </a>
        </section>
      )}
      <RoomStart />
    </>
  );
}
