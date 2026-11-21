import { KEY_CONNECTORS } from './connectors/index.js';
import type { Store } from './db.js';
import { ConnectorError, type Fetch, type SourceId } from './types.js';

const LOOKBACK_DAYS = 14;

export async function syncSource(store: Store, personToken: string, source: SourceId, fetchImpl: Fetch): Promise<number> {
  const connector = KEY_CONNECTORS[source];
  const connection = store.findConnection(personToken, source);
  if (!connector || !connection) throw new ConnectorError('Esa fuente no está conectada.', 404);
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  try {
    const drafts = await connector.pull(connection.secret, connection.account, since, fetchImpl);
    const imported = drafts.filter((draft) => store.saveEvent(personToken, draft) !== null).length;
    store.markSynced(personToken, source, null);
    return imported;
  } catch (failure) {
    store.markSynced(personToken, source, failure instanceof Error ? failure.message : 'Error desconocido.');
    throw failure;
  }
}
