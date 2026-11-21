import { useState, type FormEvent } from 'react';
import { replyToPost } from './api';
import { useAction } from './useAction';

const MAX_TEXT_LENGTH = 500;

export function ReplyForm({ token, postId, onSent }: { token: string; postId: string; onSent: () => Promise<void> }) {
  const [text, setText] = useState('');
  const [tellable, setTellable] = useState(false);
  const { busy, error, run } = useAction();
  const trimmed = text.trim();

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!trimmed) return;
    void run(async () => {
      await replyToPost(token, postId, trimmed, tellable);
      setText('');
      setTellable(false);
      await onSent();
    });
  }

  return (
    <form className="app-form" onSubmit={submit}>
      <div className="rd-actions">
        <input
          className="rd-input app-grow"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Responder"
          aria-label="Tu respuesta"
          maxLength={MAX_TEXT_LENGTH}
          autoComplete="off"
        />
        <button className="rd-button rd-button--quiet" type="submit" disabled={busy || !trimmed}>
          {busy ? 'Enviando…' : 'Responder'}
        </button>
      </div>
      <label className="rd-note app-check">
        <input type="checkbox" checked={tellable} disabled={busy} onChange={(event) => setTellable(event.target.checked)} />
        <span>Se puede contar. Si no lo marcas, la leen solo quien publicó y tú.</span>
      </label>
      {error && (
        <p className="rd-note" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
