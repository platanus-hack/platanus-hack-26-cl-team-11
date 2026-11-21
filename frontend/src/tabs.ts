import type { GlyphName } from './Glyph';

export const TABS = [
  { id: 'tu', name: 'Tú', glyph: 'person' },
  { id: 'equipo', name: 'Equipo', glyph: 'team' },
  { id: 'globo', name: 'Globo', glyph: 'globe' },
  { id: 'fuentes', name: 'Fuentes', glyph: 'sources' },
  { id: 'ajustes', name: 'Ajustes', glyph: 'settings' },
] as const satisfies ReadonlyArray<{ id: string; name: string; glyph: GlyphName }>;

export type TabId = (typeof TABS)[number]['id'];

export const DEFAULT_TAB: TabId = 'tu';
