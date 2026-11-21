import type { BoardReply } from './api';
import { Face } from './Face';
import { formatWhen } from './format';

export function ReplyItem({ reply }: { reply: BoardReply }) {
  return (
    <div className="app-reply">
      <Face name={reply.authorName} />
      {reply.text === null ? (
        <span className="rd-note app-wrap">Respuesta privada de {reply.authorName}</span>
      ) : (
        <div className="app-text">
          <span className="rd-person__name app-wrap">{reply.authorName}</span>
          <p className="app-body">{reply.text}</p>
          <span className="rd-note">
            {formatWhen(reply.createdAt)} · {reply.tellable ? 'Se puede contar' : 'Privada: la leen quien publicó y quien respondió'}
          </span>
        </div>
      )}
    </div>
  );
}
