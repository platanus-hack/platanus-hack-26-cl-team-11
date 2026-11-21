import { closePost, type BoardPost } from './api';
import { formatWhen } from './format';
import { PersonTag } from './PersonTag';
import { KIND_LABEL } from './postKinds';
import { ReplyForm } from './ReplyForm';
import { ReplyItem } from './ReplyItem';
import { useAction } from './useAction';
import { VoteBar } from './VoteBar';

export function BoardPostItem({ token, post, onChange }: { token: string; post: BoardPost; onChange: () => Promise<void> }) {
  const { busy, error, run } = useAction();

  const close = () =>
    void run(async () => {
      await closePost(token, post.id);
      await onChange();
    });

  return (
    <article className="app-post">
      <div className="app-head">
        <PersonTag name={post.authorName} detail={formatWhen(post.createdAt)} />
        <span className="rd-chip rd-glass">{KIND_LABEL[post.kind]}</span>
      </div>
      <p className="app-body">{post.text}</p>
      {post.tally && <VoteBar token={token} postId={post.id} tally={post.tally} myVote={post.myVote} onVoted={onChange} />}
      {post.replies.map((reply) => (
        <ReplyItem key={reply.id} reply={reply} />
      ))}
      <ReplyForm token={token} postId={post.id} onSent={onChange} />
      {post.mine && (
        <div className="rd-actions">
          <button className="rd-button rd-button--quiet" type="button" disabled={busy} onClick={close}>
            {busy ? 'Cerrando…' : 'Cerrar publicación'}
          </button>
        </div>
      )}
      {error && (
        <p className="rd-note" role="alert">
          {error}
        </p>
      )}
    </article>
  );
}
