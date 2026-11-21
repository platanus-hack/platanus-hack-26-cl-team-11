import type { PersonEvent } from './api';
import { formatWhen } from './format';
import { Item } from './Item';
import { ItemIcon } from './ItemIcon';
import { SourceGlyph } from './SourceGlyph';

export function EventRow({ event, sourceLabel }: { event: PersonEvent; sourceLabel: string | undefined }) {
  const when = formatWhen(event.occurredAt);
  return (
    <Item
      icon={
        <ItemIcon>
          <SourceGlyph id={event.source} />
        </ItemIcon>
      }
      title={event.summary}
      subtitle={sourceLabel ? `${sourceLabel} · ${when}` : when}
    />
  );
}
