import { Glyph, type GlyphName } from './Glyph';
import { Item } from './Item';
import { ItemIcon } from './ItemIcon';

interface PulseStatProps {
  glyph: GlyphName;
  label: string;
  value: string | null;
  note: string;
}

export function PulseStat({ glyph, label, value, note }: PulseStatProps) {
  return (
    <Item
      icon={
        <ItemIcon>
          <Glyph name={glyph} />
        </ItemIcon>
      }
      title={label}
      subtitle={note}
      end={value !== null ? <span className="rd-item__value">{value}</span> : undefined}
    />
  );
}
