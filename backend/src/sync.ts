import { findConnector } from './connectors/registry.js';
import type { AppContext } from './context.js';
import { OAUTH_PROVIDERS } from './oauth/registry.js';
import { ConnectorError, type Connection, type OAuthConnector, type OAuthTokens, type SourceId, type WindowPull } from './types.js';

const LOOKBACK_DAYS = 14;
const REFRESH_MARGIN_MS = 60_000;
const STALE_CONNECTION = 'Esta fuente ahora se conecta con tu cuenta. Vuelve a conectarla.';

const parseTokens = (secret: string): Partial<OAuthTokens> | null => {
  try {
    return JSON.parse(secret) as Partial<OAuthTokens> | null;
  } catch {
    return null;
  }
};

function readTokens(secret: string): OAuthTokens {
  const tokens = parseTokens(secret);
  if (typeof tokens?.accessToken !== 'string' || typeof tokens.expiresAt !== 'number') throw new ConnectorError(STALE_CONNECTION, 400);
  return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken ?? null, expiresAt: tokens.expiresAt };
}

async function freshAccessToken(ctx: AppContext, personToken: string, connector: OAuthConnector, connection: Connection): Promise<string> {
  const tokens = readTokens(connection.secret);
  if (tokens.expiresAt - REFRESH_MARGIN_MS > Date.now() || !tokens.refreshToken) return tokens.accessToken;
  const provider = OAUTH_PROVIDERS[connector.provider];
  const credentials = ctx.config.oauth[connector.provider];
  if (!provider || !credentials) throw new ConnectorError(`Falta configurar ${connector.provider} en el servidor.`, 500);
  const renewed = await provider.refresh(tokens.refreshToken, credentials, ctx.fetch);
  ctx.store.updateSecret(personToken, connector.id, JSON.stringify({ ...renewed, refreshToken: renewed.refreshToken ?? tokens.refreshToken }));
  return renewed.accessToken;
}

async function pull(ctx: AppContext, personToken: string, source: SourceId, connection: Connection, since: Date): Promise<WindowPull> {
  const connector = findConnector(source);
  if (connector?.kind === 'key') return { drafts: await connector.pull(connection.secret, connection.account, since, ctx.fetch), window: null };
  if (connector?.kind === 'oauth') {
    const accessToken = await freshAccessToken(ctx, personToken, connector, connection);
    if (connector.pullWindow) return connector.pullWindow(accessToken, connection.account, since, ctx.fetch);
    return { drafts: await connector.pull(accessToken, connection.account, since, ctx.fetch), window: null };
  }
  throw new ConnectorError('Esa fuente no se sincroniza.', 400);
}

export async function syncSource(ctx: AppContext, personToken: string, source: SourceId): Promise<number> {
  const connection = ctx.store.findConnection(personToken, source);
  if (!connection) throw new ConnectorError('Esa fuente no está conectada.', 404);
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  try {
    const { drafts, window } = await pull(ctx, personToken, source, connection, since);
    const imported = drafts.filter((draft) => ctx.store.saveEvent(personToken, draft) !== null).length;
    if (window) {
      ctx.store.pruneEvents(
        personToken,
        source,
        window.from,
        window.to,
        drafts.flatMap((draft) => (draft.externalId ? [draft.externalId] : [])),
      );
    }
    ctx.store.markSynced(personToken, source, null);
    return imported;
  } catch (failure) {
    ctx.store.markSynced(personToken, source, failure instanceof Error ? failure.message : 'Error desconocido.');
    throw failure;
  }
}
