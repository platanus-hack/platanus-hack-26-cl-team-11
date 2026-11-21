import { Face } from './Face';
import { Glyph } from './Glyph';
import { TABS, type TabId } from './tabs';

const YOU: TabId = 'tu';

export function TabBar({ active, name, onSelect }: { active: TabId; name: string; onSelect: (tab: TabId) => void }) {
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
          {tab.id === YOU ? <Face name={name} size="tab" /> : <Glyph name={tab.glyph} />}
          <span className="rd-tabbar__name" aria-hidden="true">
            {tab.name}
          </span>
        </button>
      ))}
    </nav>
  );
}
