import type { BoardAnswer } from './api';

const names = new Intl.ListFormat('es', { style: 'long', type: 'conjunction' });

function noteOf(answer: BoardAnswer) {
  if (answer.status === 'en_curso') return 'Los agentes del equipo están respondiendo…';
  if (answer.status === 'fallida') return answer.problem ?? 'Los agentes no pudieron responder.';
  if (answer.text === null) return answer.asked === 0 ? 'Nadie del equipo comparte todavía algo con su agente.' : 'Ningún agente tenía algo que aportar.';
  return `Armada con lo que ${answer.sources.length === 1 ? 'comparte' : 'comparten'} ${names.format(answer.sources)}`;
}

export function AgentAnswer({ answer }: { answer: BoardAnswer }) {
  return (
    <div className="app-text">
      {answer.text && (
        <>
          <span className="rd-person__name">Respuesta de los agentes</span>
          <p className="app-body">{answer.text}</p>
        </>
      )}
      <span className="rd-note" role={answer.status === 'fallida' ? 'alert' : 'status'}>
        {noteOf(answer)}
      </span>
    </div>
  );
}
