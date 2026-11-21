import { voteOnPost, type VoteTally, type VoteValue } from './api';
import { countOf } from './format';
import { useAction } from './useAction';

const VOTE_VALUES: readonly VoteValue[] = ['a_favor', 'en_contra'];

const VOTE_LABEL: Record<VoteValue, string> = {
  a_favor: 'A favor',
  en_contra: 'En contra',
};

const MY_VOTE_TEXT: Record<VoteValue, string> = {
  a_favor: 'Tu voto: a favor.',
  en_contra: 'Tu voto: en contra.',
};

interface VoteBarProps {
  token: string;
  postId: string;
  tally: VoteTally;
  myVote: VoteValue | null;
  onVoted: () => Promise<void>;
}

export function VoteBar({ token, postId, tally, myVote, onVoted }: VoteBarProps) {
  const { busy, error, run } = useAction();

  const vote = (value: VoteValue) =>
    void run(async () => {
      await voteOnPost(token, postId, value);
      await onVoted();
    });

  return (
    <>
      <span className="rd-note">
        {tally.aFavor.toLocaleString('es-CL')} a favor · {tally.enContra.toLocaleString('es-CL')} en contra · {countOf(tally.total, 'persona', 'personas')} en el equipo.{' '}
        {myVote ? MY_VOTE_TEXT[myVote] : 'Todavía no votas.'}
      </span>
      <div className="rd-actions" role="group" aria-label="Tu voto">
        {VOTE_VALUES.map((value) => (
          <button
            key={value}
            type="button"
            className={`rd-button rd-button--quiet${myVote && myVote !== value ? ' app-off' : ''}`}
            aria-pressed={myVote === value}
            disabled={busy}
            onClick={() => vote(value)}
          >
            {VOTE_LABEL[value]}
          </button>
        ))}
      </div>
      {error && (
        <p className="rd-note" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
