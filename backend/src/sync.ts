import { findConnector } from './connectors/registry.js';
import type { AppContext } from './context.js';
import { OAUTH_PROVIDERS } from './oauth/registry.js';
import { ConnectorError, type Connection, type EventDraft, type OAuthConnector, type OAuthTokens, type SourceId } from './types.js';

const LOOKBACK_DAYS = 14;
const REFRESH_MARGIN_MS = 60_000;

async function freshAccessToken(ctx: AppContext, personToken: string, connector: OAuthConnector, connection: Connection): Promise<string> {
  const tokens = JSON.parse(connection.secret) as OAuthTokens;
  if (tokens.expiresAt - REFRESH_MARGIN_MS > Date.now() || !tokens.refreshToken) return tokens.accessToken;
  const provider = OAUTH_PROVIDERS[connector.provider];
  const credentials = ctx.config.oauth[connector.provider];
  if (!provider || !credentials) throw new ConnectorError(`Falta configurar ${connector.provider} en el servidor.`, 500);
  const renewed = await provider.refresh(tokens.refreshToken, credentials, ctx.fetch);
  ctx.store.updateSecret(personToken, connector.id, JSON.stringify({ ...renewed, refreshToken: renewed.refreshToken ?? tokens.refreshToken }));
  return renewed.accessToken;
}

async function pull(ctx: AppContext, personToken: string, source: SourceId, connection: Connection, since: Date): Promise<EventDraft[]> {
  const connector = findConnector(source);
  if (connector?.kind === 'key') return connector.pull(connection.secret, connection.account, since, ctx.fetch);
  if (connector?.kind === 'oauth') return connector.pull(await freshAccessToken(ctx, personToken, connector, connection), connection.account, since, ctx.fetch);
  throw new ConnectorError('Esa fuente no se sincroniza.', 400);
}

export async function syncSource(ctx: AppContext, personToken: string, source: SourceId): Promise<number> {
  const connection = ctx.store.findConnection(personToken, source);
  if (!connection) throw new ConnectorError('Esa fuente no está conectada.', 404);
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  try {
    const drafts = await pull(ctx, personToken, source, connection, since);
    const imported = drafts.filter((draft) => ctx.store.saveEvent(personToken, draft) !== null).length;
    ctx.store.markSynced(personToken, source, null);
    return imported;
  } catch (failure) {
    ctx.store.markSynced(personToken, source, failure instanceof Error ? failure.message : 'Error desconocido.');
    throw failure;
  }
}
