import type { Source } from './api';
import { formatWhen } from './format';

export const isConnected = (source: Source) => Boolean(source.connection) || (source.connect === 'push' && Boolean(source.sync));

export const isConfigured = (source: Source) => source.configured ?? true;

export const lastRecordOf = (source: Source) => (source.sync ? `Último registro: ${formatWhen(source.sync.last)}` : null);

export function stateOf(source: Source) {
  if (source.connect === 'soon') return 'Próximamente';
  if (source.connection) return source.connection.lastError ?? source.connection.account;
  if (source.connect === 'push' && source.delivery) return `${source.delivery.ok ? 'Último envío' : 'El último envío falló'}: ${formatWhen(source.delivery.at)}`;
  if (source.connect === 'push') return lastRecordOf(source) ?? 'Esperando el primer envío';
  if (source.connect === 'oauth' && !isConfigured(source)) return 'Falta configurarla en el servidor';
  return source.how;
}
