import { Glyph } from './Glyph';
import { ItemIcon } from './ItemIcon';
import type { AssistantKind } from './roomApi';
import { SourceLogo } from './SourceLogo';

const SOURCE_OF_KIND: Partial<Record<AssistantKind, string>> = { 'claude-code': 'claude', claude: 'claude', codex: 'codex' };

export function AssistantLogo({ kind }: { kind: AssistantKind }) {
  const source = SOURCE_OF_KIND[kind];
  if (source) return <SourceLogo id={source} />;
  return (
    <ItemIcon>
      <Glyph name="agent" />
    </ItemIcon>
  );
}
