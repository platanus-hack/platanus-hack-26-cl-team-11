export type Team = {
  team: string;
  id: string;
  name: string;
  price: number;
  q: number;
  presenting: boolean;
  description: string;
};
export type Board = { at: number; status: string; teams: Team[] };
export type Series = Team & { at: number; points: [number, number][]; change5m: number | null };
export const pct = (v: number) =>
  v.toLocaleString('es-CL', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const move = (v: number) => (v > 0 ? '+' : '') + pct(v);
export const teamLabel = (team: string) => 'Equipo ' + team.replace('team-', '');
export const label = (t: Team) => (t.name === t.team ? teamLabel(t.team) : t.name);
export const clock = (t: number) =>
  new Date(t).toLocaleTimeString('es-CL', {
    timeZone: 'America/Santiago',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
export async function read<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(12000), ...init });
  if (!res.ok) throw new Error('Petición pendiente');
  return res.json();
}
export function saved<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem('mesa26.' + key) || 'null') ?? fallback;
  } catch {
    return fallback;
  }
}
export function save(key: string, value: unknown) {
  try {
    localStorage.setItem('mesa26.' + key, JSON.stringify(value));
  } catch {
    /* Private browsing may disable storage. */
  }
}
