import type { Visibility } from './api';
import { Glyph } from './Glyph';
import { Item } from './Item';
import { ItemIcon } from './ItemIcon';
import { RowButton } from './RowButton';
import { VISIBILITY_LABEL, type SignalGroup } from './signalGroups';
import { VisibilityChoice } from './VisibilityChoice';

interface PermissionRowProps {
  group: SignalGroup;
  visibility: Visibility | null;
  disabled: boolean;
  open: boolean;
  onToggle: () => void;
  onChange: (visibility: Visibility) => void;
}

export function PermissionRow({ group, visibility, disabled, open, onToggle, onChange }: PermissionRowProps) {
  return (
    <div>
      <Item
        icon={
          <ItemIcon>
            <Glyph name={group.glyph} />
          </ItemIcon>
        }
        title={group.title}
        subtitle={visibility ? VISIBILITY_LABEL[visibility] : undefined}
        end={visibility ? <RowButton label="Cambiar" name={`Cambiar el permiso de ${group.title}`} expanded={open} onClick={onToggle} /> : undefined}
      />
      {open && visibility && (
        <div className="rd-item__detail">
          <VisibilityChoice label={`Permiso de ${group.title}`} value={visibility} disabled={disabled} onChange={onChange} />
        </div>
      )}
    </div>
  );
}
