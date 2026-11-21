import { Glyph } from './Glyph';
import { MORE_SOURCES } from './moreSources';

interface MoreSourcesPickerProps {
  wanted: string[];
  onToggle: (id: string) => void;
}

export function MoreSourcesPicker({ wanted, onToggle }: MoreSourcesPickerProps) {
  return (
    <>
      <p className="rd-note">Marca las que usas. Todavía no se conectan: las vamos sumando según lo que más se pida.</p>
      <div className="app-picks" role="group" aria-label="Otras integraciones">
        {MORE_SOURCES.map((source) => {
          const picked = wanted.includes(source.id);
          return (
            <button key={source.id} type="button" className="rd-button rd-button--quiet rd-button--small" aria-pressed={picked} onClick={() => onToggle(source.id)}>
              <img className="app-pick-icon" src={source.icon} alt="" />
              {source.label}
              {picked && <Glyph name="check" />}
            </button>
          );
        })}
      </div>
    </>
  );
}
