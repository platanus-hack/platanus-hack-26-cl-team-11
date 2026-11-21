import { useState, type FormEvent } from 'react';

interface KeyFormProps {
  label: string;
  busy: boolean;
  onSubmit: (secret: string) => void;
}

export function KeyForm({ label, busy, onSubmit }: KeyFormProps) {
  const [secret, setSecret] = useState('');
  const trimmed = secret.trim();

  function submit(event: FormEvent) {
    event.preventDefault();
    if (trimmed) onSubmit(trimmed);
  }

  return (
    <form className="rd-actions" onSubmit={submit}>
      <input
        className="rd-input app-grow"
        type="password"
        autoComplete="off"
        value={secret}
        onChange={(event) => setSecret(event.target.value)}
        placeholder={`Pega tu llave de ${label}`}
        aria-label={`Llave de ${label}`}
      />
      <button className="rd-button" type="submit" disabled={busy || !trimmed}>
        {busy ? 'Conectando…' : 'Conectar'}
      </button>
    </form>
  );
}
