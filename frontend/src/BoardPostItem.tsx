import { useState } from 'react';
import { closePost, type BoardPost } from './api';
import { Face } from './Face';
import { countOf, formatWhen } from './format';
import { Item } from './Item';
import { KIND_LABEL } from './postKinds';
import { ReplyForm } from './ReplyForm';
import { ReplyItem } from './ReplyItem';
import { RowButton } from './RowButton';
import { useAction } from './useAction';
import { VoteBar } from './VoteBar';

export function BoardPostItem({ token, post, onChange }: { token: string; post: BoardPost; onChange: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const { busy, error, run } = useAction();

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
          {post.tally && <VoteBar token={token} postId={post.id} tally={post.tally} myVote={post.myVote} onVoted={onChange} />}
          {post.replies.map((reply) => (
            <ReplyItem key={reply.id} reply={reply} />
          ))}
          <ReplyForm token={token} postId={post.id} onSent={onChange} />
          {post.mine && (
            <div className="rd-actions">
              <RowButton label={busy ? 'Cerrando…' : 'Cerrar publicación'} disabled={busy} onClick={close} />
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
