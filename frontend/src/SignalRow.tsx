import type { Signals } from './api';
import { Glyph } from './Glyph';
import { Item } from './Item';
import { ItemIcon } from './ItemIcon';
import { basisOf, statementsOf, VISIBILITY_LABEL, type SignalGroup } from './signalGroups';

const CHECKIN_BASIS = 'checkin';

interface SignalRowProps {
  group: SignalGroup;
  signals: Signals;
  sourceLabels: ReadonlyMap<string, string>;
  open: boolean;
  onToggle: () => void;
}

export function SignalRow({ group, signals, sourceLabels, open, onToggle }: SignalRowProps) {
  const [first, ...rest] = statementsOf(signals, group.key);
  const basis = basisOf(signals, group.key).map((entry) => sourceLabels.get(entry) ?? (entry === CHECKIN_BASIS ? 'tu check-in' : entry));

  return (
    <div>
      <Item
        icon={
          <ItemIcon>
            <Glyph name={group.glyph} />
          </ItemIcon>
        }
        title={group.title}
        subtitle={rest.length > 0 ? `${first} · ${rest.length} más` : first}
        expanded={open}
        onToggle={onToggle}
      />
      {open && (
        <div className="rd-item__detail">
          {statementsOf(signals, group.key, true).map((statement, position) => (
            <p className="app-body" key={position}>
              {statement}
            </p>
          ))}
          {basis.length > 0 && <span className="rd-note app-wrap">Sale de: {basis.join(', ')}</span>}
          <span className="rd-note">Permiso: {VISIBILITY_LABEL[signals.visibility[group.key]]}. Lo cambias en Ajustes.</span>
        </div>
      )}
    </div>
  );
}
