import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { IconButton } from './IconButton';

export function OverflowMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <div className="app-top__menu" ref={root}>
      <IconButton glyph="more" label="Más opciones" bare expanded={open} controls={open ? panelId : undefined} onClick={() => setOpen((current) => !current)} />
      {open && (
        <div className="rd-menu rd-glass" id={panelId}>
          {children}
        </div>
      )}
    </div>
  );
}
