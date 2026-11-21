import type { BoardReply } from './api';
import { Face } from './Face';
import { formatWhen } from './format';

export function ReplyItem({ reply }: { reply: BoardReply }) {
  const author = reply.byAgent ? `Agente de ${reply.authorName}` : reply.authorName;
  const reach = reply.byAgent ? `Con lo que ${reply.authorName} comparte` : reply.tellable ? 'Se puede contar' : 'Privada: la leen quien publicó y quien respondió';
  return (
    <div className="app-reply">
      <Face name={reply.authorName} />
      {reply.text === null ? (
        <span className="rd-note app-wrap">Respuesta privada de {reply.authorName}</span>
      ) : (
        <div className="app-text">
          <span className="rd-person__name app-wrap">{author}</span>
          <p className="app-body">{reply.text}</p>
          <span className="rd-note">
            {formatWhen(reply.createdAt)} · {reach}
          </span>
        </div>
      )}
    </div>
  );
}
