import { Glyph, type GlyphName } from './Glyph';

interface IconButtonProps {
  glyph: GlyphName;
  label: string;
  bare?: boolean;
  expanded?: boolean;
  controls?: string;
  onClick: () => void;
}

export function IconButton({ glyph, label, bare = false, expanded, controls, onClick }: IconButtonProps) {
  return (
    <button
      className={`rd-iconbutton${bare ? ' rd-iconbutton--bare' : ''}`}
      type="button"
      aria-label={label}
      aria-expanded={expanded}
      aria-controls={controls}
      onClick={onClick}
    >
      <Glyph name={glyph} />
    </button>
  );
}
