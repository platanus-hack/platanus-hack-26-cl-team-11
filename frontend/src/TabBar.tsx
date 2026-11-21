import { Glyph } from './Glyph';
import { TABS, type TabId } from './tabs';

export function TabBar({ active, onSelect }: { active: TabId; onSelect: (tab: TabId) => void }) {
  return (
    <nav className="rd-tabbar rd-glass" aria-label="Secciones">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          className="rd-tabbar__tab"
          type="button"
          aria-label={tab.name}
          aria-current={active === tab.id ? 'page' : undefined}
          onClick={() => onSelect(tab.id)}
        >
          <Glyph name={tab.glyph} />
          <span className="rd-tabbar__name" aria-hidden="true">
            {tab.name}
          </span>
        </button>
      ))}
    </nav>
  );
}
