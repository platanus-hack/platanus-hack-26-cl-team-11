import type { PersonEvent } from './api';
import { formatWhen } from './format';
import { Item } from './Item';
import { SourceLogo } from './SourceLogo';

export function EventRow({ event, sourceLabel }: { event: PersonEvent; sourceLabel: string | undefined }) {
  const when = formatWhen(event.occurredAt);
  return (
    <Item
      icon={<SourceLogo id={event.source} />}
      title={event.summary}
      subtitle={sourceLabel ? `${sourceLabel} · ${when}` : when}
    />
  );
}
