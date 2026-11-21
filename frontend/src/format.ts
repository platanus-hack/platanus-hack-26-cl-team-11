export const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

export const formatClock = (iso: string) => new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

export const formatDay = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'short' });

export const messageOf = (failure: unknown, fallback: string) => (failure instanceof Error ? failure.message : fallback);

export const countOf = (count: number, one: string, many: string) => `${count.toLocaleString('es-CL')} ${count === 1 ? one : many}`;
