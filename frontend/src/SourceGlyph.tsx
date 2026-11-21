const PATHS: Record<string, string[]> = {
  'apple-health': ['M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z'],
  granola: ['M9.5 3.5h5v9a2.5 2.5 0 0 1-5 0z', 'M5.5 11a6.5 6.5 0 0 0 13 0', 'M12 17.5v3'],
  gmail: ['M3.5 6.5h17v11h-17z', 'M3.5 7l8.5 6 8.5-6'],
  claude: ['M12 3.5v17', 'M3.5 12h17', 'M6 6l12 12', 'M18 6L6 18'],
  codex: ['M3.5 5.5h17v13h-17z', 'M7.5 10l2.5 2-2.5 2', 'M12.5 15h4'],
  calendar: ['M3.5 5.5h17v15h-17z', 'M3.5 10h17', 'M8 3v4', 'M16 3v4'],
  whatsapp: ['M4 12a8 8 0 1 1 3.4 6.5L4 19.8l1.3-3.5A8 8 0 0 1 4 12z'],
  github: ['M7 4.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4z', 'M7 15.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4z', 'M17 6.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4z', 'M7 8.5v7', 'M17 10.5c0 3-3 4-8.5 5.5'],
};

export function SourceGlyph({ id }: { id: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {(PATHS[id] ?? ['M12 4a8 8 0 1 1 0 16 8 8 0 0 1 0-16z']).map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
