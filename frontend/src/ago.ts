import { formatWhen } from './format';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export function formatAgo(iso: string, now: number) {
  const elapsed = Math.max(0, now - new Date(iso).getTime());
  if (elapsed < MINUTE) return 'Ahora';
  if (elapsed < HOUR) return `Hace ${Math.floor(elapsed / MINUTE)} min`;
  if (elapsed < 24 * HOUR) return `Hace ${Math.floor(elapsed / HOUR)} h`;
  if (elapsed < 48 * HOUR) return 'Ayer';
  return formatWhen(iso);
}
