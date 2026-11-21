export const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

export const messageOf = (failure: unknown, fallback: string) => (failure instanceof Error ? failure.message : fallback);

export const countOf = (count: number, one: string, many: string) => `${count.toLocaleString('es-CL')} ${count === 1 ? one : many}`;
