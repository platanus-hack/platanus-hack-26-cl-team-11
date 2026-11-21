import { useState, type FormEvent } from 'react';
import { POST_KINDS, publishPost, type PostKind } from './api';
import { KIND_LABEL } from './postKinds';
import { useAction } from './useAction';

const MAX_TEXT_LENGTH = 500;

export function PostForm({ token, teamId, onPublished }: { token: string; teamId: string; onPublished: () => Promise<void> }) {
  const [kind, setKind] = useState<PostKind>('pregunta');
  const [text, setText] = useState('');
  const { busy, error, run } = useAction();
  const trimmed = text.trim();

  function choose(value: string) {
    const chosen = POST_KINDS.find((option) => option === value);
    if (chosen) setKind(chosen);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!trimmed) return;
    void run(async () => {
      await publishPost(token, teamId, kind, trimmed);
      setText('');
      await onPublished();
    });
  }

  return (
    <form className="app-form" onSubmit={submit}>
      <textarea
        className="rd-input app-area"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Escribe una pregunta, un pedido o una propuesta para tu equipo"
        aria-label="Texto de la publicación"
        maxLength={MAX_TEXT_LENGTH}
      />
      <div className="rd-actions">
        <select className="rd-input app-grow" aria-label="Tipo de publicación" value={kind} disabled={busy} onChange={(event) => choose(event.target.value)}>
          {POST_KINDS.map((option) => (
            <option key={option} value={option}>
              {KIND_LABEL[option]}
            </option>
          ))}
        </select>
        <button className="rd-button rd-button--quiet" type="submit" disabled={busy || !trimmed}>
          {busy ? 'Publicando…' : 'Publicar'}
        </button>
      </div>
      {error && (
        <p className="rd-note" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
