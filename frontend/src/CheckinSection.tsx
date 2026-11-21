import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { fetchCheckins, MOODS, recordCheckin, type CheckinEntry, type Mood } from './api';
import { formatWhen, messageOf } from './format';
import { SectionHead } from './SectionHead';
import { useAction } from './useAction';

const MAX_TEXT_LENGTH = 280;

const MOOD_LABEL: Record<Mood, string> = {
  bien: 'Bien',
  normal: 'Normal',
  cansada: 'Con cansancio',
  mal: 'Mal',
};

type LastCheckin = { state: 'loading' } | { state: 'failed'; message: string } | { state: 'ready'; entry: CheckinEntry | null };

function lastText(last: LastCheckin) {
  if (last.state === 'loading') return 'Cargando tu último check-in…';
  if (last.state === 'failed') return last.message;
  if (!last.entry) return 'Todavía no haces un check-in.';
  return `Último check-in: ${formatWhen(last.entry.at)} · ${MOOD_LABEL[last.entry.mood]}`;
}


export function CheckinSection({ token, onSaved }: { token: string; onSaved: () => void }) {
  const [mood, setMood] = useState<Mood | null>(null);
  const [blocker, setBlocker] = useState('');
  const [note, setNote] = useState('');
  const [last, setLast] = useState<LastCheckin>({ state: 'loading' });
  const { busy, error, run } = useAction();

  const loadLast = useCallback(
    () =>
      fetchCheckins(token)
        .then((entries) => setLast({ state: 'ready', entry: entries[0] ?? null }))
        .catch((failure: unknown) => setLast({ state: 'failed', message: messageOf(failure, 'No se pudo cargar tu último check-in.') })),
    [token],
  );

  useEffect(() => {
    void loadLast();
  }, [loadLast]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!mood) return;
    void run(async () => {
      await recordCheckin(token, { mood, blocker: blocker.trim() || null, note: note.trim() || null });
      setMood(null);
      setBlocker('');
      setNote('');
      onSaved();
      await loadLast();
    });
  }


  return (
    <div className="app-block">
      <SectionHead title="Tu check-in de hoy" />
      <form className="app-form" onSubmit={submit}>
        <div className="rd-actions" role="group" aria-label="Cómo llegas hoy">
          {MOODS.map((option) => (
            <button
              key={option}
              type="button"
              className={`rd-button rd-button--quiet app-choice${mood && mood !== option ? ' app-off' : ''}`}
              aria-pressed={mood === option}
              disabled={busy}
              onClick={() => setMood(option)}
            >
              {MOOD_LABEL[option]}
            </button>
          ))}
        </div>
        <input
          className="rd-input"
          value={blocker}
          onChange={(event) => setBlocker(event.target.value)}
          placeholder="¿Algo te está frenando? (opcional)"
          aria-label="Bloqueo"
          maxLength={MAX_TEXT_LENGTH}
          autoComplete="off"
        />
        <textarea
          className="rd-input app-area"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Una nota para ti (opcional)"
          aria-label="Nota"
          maxLength={MAX_TEXT_LENGTH}
        />
        <div className="rd-actions">
          <button className="rd-button" type="submit" disabled={busy || !mood}>
            {busy ? 'Guardando…' : 'Guardar check-in'}
          </button>
        </div>
      </form>
      {error && (
        <p className="rd-note" role="alert">
          {error}
        </p>
      )}
      <p className="rd-note">{lastText(last)}</p>
      <p className="rd-note">La nota no sale de aquí. Del bloqueo puede salir una frase, según tu permiso para bloqueos.</p>
    </div>
  );
}
