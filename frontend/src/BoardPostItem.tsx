import { useState } from 'react';
import { AgentAnswer } from './AgentAnswer';
import { askAgents, closePost, type BoardPost } from './api';
import { Face } from './Face';
import { countOf, formatWhen } from './format';
import { Item } from './Item';
import { KIND_LABEL } from './postKinds';
import { ReplyForm } from './ReplyForm';
import { ReplyItem } from './ReplyItem';
import { RowButton } from './RowButton';
import { useAction } from './useAction';
import { VoteBar } from './VoteBar';

interface BoardPostItemProps {
  token: string;
  post: BoardPost;
  configured: boolean;
  onChange: () => Promise<void>;
}

export function BoardPostItem({ token, post, configured, onChange }: BoardPostItemProps) {
  const answering = post.answer?.status === 'en_curso';
  const [open, setOpen] = useState(post.mine && answering);
  const { busy, error, run } = useAction();
  const canAsk = post.mine && post.kind === 'pregunta' && configured && !answering;

  const ask = () =>
    void run(async () => {
      await askAgents(token, post.id);
      await onChange();
    });

  const close = () =>
    void run(async () => {
      await closePost(token, post.id);
      await onChange();
    });

  const replies = post.replies.length > 0 ? ` · ${countOf(post.replies.length, 'respuesta', 'respuestas')}` : '';

  return (
    <article>
      <Item
        icon={<Face name={post.authorName} />}
        title={post.authorName}
        subtitle={`${KIND_LABEL[post.kind]} · ${post.text}`}
        expanded={open}
        onToggle={() => setOpen((current) => !current)}
      />
      {open && (
        <div className="rd-item__detail">
          <p className="app-body">{post.text}</p>
          <span className="rd-note">
            {KIND_LABEL[post.kind]} · {formatWhen(post.createdAt)}
            {replies}
          </span>
          {post.answer && <AgentAnswer answer={post.answer} />}
          {post.tally && <VoteBar token={token} postId={post.id} tally={post.tally} myVote={post.myVote} onVoted={onChange} />}
          {post.replies.map((reply) => (
            <ReplyItem key={reply.id} reply={reply} />
          ))}
          <ReplyForm token={token} postId={post.id} onSent={onChange} />
          {post.mine && (
            <div className="rd-actions">
              {canAsk && <RowButton label={post.answer ? 'Preguntar de nuevo' : 'Preguntar a los agentes'} disabled={busy} onClick={ask} />}
              <RowButton label="Cerrar publicación" disabled={busy} onClick={close} />
            </div>
          )}
          {error && (
            <p className="rd-note" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </article>
  );
}
