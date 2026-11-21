import { answerProposal, type AgentProposal, type PartyDecision, type ProposalParty } from './api';
import { Glyph } from './Glyph';
import { Item } from './Item';
import { ItemIcon } from './ItemIcon';
import { RowButton } from './RowButton';
import { useAction } from './useAction';

interface ProposalRowProps {
  token: string;
  proposal: AgentProposal;
  onChange: () => Promise<void>;
}

const nameOf = (party: ProposalParty) => (party.me ? 'tú' : party.name);

function progressOf(proposal: AgentProposal) {
  if (proposal.status === 'acordada') return 'Acordada';
  if (proposal.status === 'descartada') return 'Descartada';
  const waiting = proposal.parties.filter((party) => party.answer === 'pendiente').map(nameOf);
  return `Falta que acepte: ${waiting.join(', ')}`;
}

export function ProposalRow({ token, proposal, onChange }: ProposalRowProps) {
  const { busy, error, run } = useAction();
  const awaitsMe = proposal.status === 'por_aprobar' && proposal.myAnswer === 'pendiente';

  const answer = (decision: PartyDecision) =>
    void run(async () => {
      await answerProposal(token, proposal.id, decision);
      await onChange();
    });

  return (
    <div>
      <Item
        icon={
          <ItemIcon>
            <Glyph name="team" />
          </ItemIcon>
        }
        title={proposal.text}
        subtitle={progressOf(proposal)}
        off={proposal.status === 'descartada'}
      />
      {(awaitsMe || error) && (
        <div className="rd-item__detail">
          {awaitsMe && (
            <div className="rd-actions">
              <RowButton label="Aceptar" name="Aceptar la propuesta" disabled={busy} onClick={() => answer('acepta')} />
              <RowButton label="Ahora no" name="Rechazar la propuesta" disabled={busy} onClick={() => answer('rechaza')} />
            </div>
          )}
          {error && (
            <span className="rd-note" role="alert">
              {error}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
