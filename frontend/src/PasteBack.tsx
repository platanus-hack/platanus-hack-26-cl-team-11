import { useState, type FormEvent } from 'react';
import { CopyButton } from './CopyButton';
import { ASSISTANT_NAME, pasteAnswer, type AssistantKind } from './roomApi';
import { useAction } from './useAction';

const CHAT_APPS: AssistantKind[] = ['chatgpt', 'claude', 'grok', 'gemini', 'instinct', 'otro'];
const MAX_ANSWER_LENGTH = 8000;

const QUESTION = [
  'Resume lo que sabes de mi trabajo para compartirlo con mi equipo. Responde en español, sin datos privados ni contraseñas, con estos cuatro puntos:',
  '',
  '1. Quién soy en el trabajo: rol, equipo y proyecto actual.',
  '2. En qué estoy trabajando esta semana.',
  '3. Qué me tiene trabado y qué ayuda me serviría. Sé específico.',
  '4. Qué sé hacer bien y en qué podría ayudar a otra persona.',
  '',
  'Máximo 300 palabras. Si no sabes algo, dilo. No inventes.',
].join('\n');

const isChatApp = (value: string): value is AssistantKind => (CHAT_APPS as string[]).includes(value);

export function PasteBack({ token, onSaved }: { token: string; onSaved: () => void }) {
  const [kind, setKind] = useState<AssistantKind>('chatgpt');
  const [answer, setAnswer] = useState('');
  const { busy, error, run } = useAction();
  const text = answer.trim();

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!text) return;
    void run(async () => {
      await pasteAnswer(token, kind, text);
      setAnswer('');
      onSaved();
    });
  }

  return (
    <>
      <span className="rd-note">1. Copia esta pregunta y pégala en tu app.</span>
      <span className="rd-code app-body">{QUESTION}</span>
      <div className="rd-actions">
        <CopyButton text={QUESTION} label="Copiar la pregunta" />
      </div>
      <span className="rd-note">2. Pega aquí lo que respondió. Queda en «Te pregunta antes» hasta que tú lo cambies.</span>
      <form className="app-form" onSubmit={submit}>
        <select className="rd-input" aria-label="App de chat" value={kind} disabled={busy} onChange={(event) => isChatApp(event.target.value) && setKind(event.target.value)}>
          {CHAT_APPS.map((app) => (
            <option key={app} value={app}>
              {ASSISTANT_NAME[app]}
            </option>
          ))}
        </select>
        <textarea
          className="rd-input app-area"
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          placeholder="La respuesta de tu asistente"
          aria-label="Respuesta de tu asistente"
          maxLength={MAX_ANSWER_LENGTH}
        />
        <div className="rd-actions">
          <button className="rd-button rd-button--quiet" type="submit" disabled={busy || !text}>
            {busy ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
      {error && (
        <span className="rd-note" role="alert">
          {error}
        </span>
      )}
    </>
  );
}
