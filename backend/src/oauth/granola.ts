import { ConnectorError, type Fetch, type OAuthProvider, type OAuthTokens } from '../types.js';
import { readGrant, tokensFrom } from './tokens.js';

const AUTHORIZE_URL = 'https://mcp-auth.granola.ai/oauth2/authorize';
const TOKEN_URL = 'https://mcp-auth.granola.ai/oauth2/token';
export const GRANOLA_MCP_URL = 'https://mcp.granola.ai/mcp';
const PROTOCOL_VERSION = '2025-06-18';
const CLIENT_INFO = { name: 'ronda', version: '1' };
const EVENT_STREAM = 'text/event-stream';
const STREAM_DATA_PREFIX = 'data:';
const SESSION_HEADER = 'mcp-session-id';
const ACCOUNT_EMAIL = /connected_user_email="([^"]+)"/;
const UNKNOWN_ACCOUNT = 'cuenta de Granola';

interface RpcMessage {
  id?: number;
  result?: { content?: Array<{ type?: string; text?: string }>; isError?: boolean };
  error?: { message?: string };
}

async function send(fetchImpl: Fetch, url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetchImpl(url, init);
  } catch {
    throw new ConnectorError('No se pudo contactar a Granola.');
  }
}

async function requestTokens(fetchImpl: Fetch, form: Record<string, string>): Promise<OAuthTokens> {
  const response = await send(fetchImpl, TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: new URLSearchParams({ ...form, resource: GRANOLA_MCP_URL }).toString(),
  });
  const grant = await readGrant(response);
  if (response.status === 401) throw new ConnectorError('Granola rechazó las credenciales del servidor.', 500);
  if (response.status === 400 || grant.error) throw new ConnectorError('Granola no aceptó la autorización. Vuelve a conectar tu cuenta.', 400);
  if (!response.ok) throw new ConnectorError(`Granola respondió ${response.status}.`);
  if (!grant.access_token) throw new ConnectorError('Granola respondió sin acceso.');
  return tokensFrom(grant.access_token, grant);
}

function messagesOf(contentType: string, body: string): RpcMessage[] {
  const chunks = contentType.includes(EVENT_STREAM)
    ? body
        .split('\n')
        .filter((line) => line.startsWith(STREAM_DATA_PREFIX))
        .map((line) => line.slice(STREAM_DATA_PREFIX.length).trim())
    : [body];
  return chunks.flatMap((chunk) => {
    try {
      const parsed: unknown = JSON.parse(chunk);
      return parsed && typeof parsed === 'object' ? [parsed as RpcMessage] : [];
    } catch {
      return [];
    }
  });
}

async function rpc(fetchImpl: Fetch, accessToken: string, sessionId: string | null, message: Record<string, unknown>): Promise<{ sessionId: string | null; reply: RpcMessage | null }> {
  const response = await send(fetchImpl, GRANOLA_MCP_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
      accept: `application/json, ${EVENT_STREAM}`,
      'mcp-protocol-version': PROTOCOL_VERSION,
      ...(sessionId ? { [SESSION_HEADER]: sessionId } : {}),
    },
    body: JSON.stringify({ jsonrpc: '2.0', ...message }),
  });
  if (response.status === 401 || response.status === 403) throw new ConnectorError('Granola dio por vencido el acceso. Vuelve a conectar tu cuenta.', 400);
  if (response.status === 429) throw new ConnectorError('Granola pidió esperar antes de reintentar.', 429);
  if (!response.ok) throw new ConnectorError(`Granola respondió ${response.status}.`);
  const messages = messagesOf(response.headers.get('content-type') ?? '', await response.text().catch(() => ''));
  return { sessionId: response.headers.get(SESSION_HEADER) ?? sessionId, reply: messages.find((candidate) => candidate.id === message.id) ?? null };
}

export async function callGranolaTool(fetchImpl: Fetch, accessToken: string, name: string, args: Record<string, unknown>): Promise<string> {
  const opened = await rpc(fetchImpl, accessToken, null, { id: 1, method: 'initialize', params: { protocolVersion: PROTOCOL_VERSION, capabilities: {}, clientInfo: CLIENT_INFO } });
  await rpc(fetchImpl, accessToken, opened.sessionId, { method: 'notifications/initialized' });
  const { reply } = await rpc(fetchImpl, accessToken, opened.sessionId, { id: 2, method: 'tools/call', params: { name, arguments: args } });
  if (!reply?.result || reply.error || reply.result.isError) throw new ConnectorError('Granola no entregó tus reuniones.');
  return (reply.result.content ?? []).flatMap((part) => (part.type === 'text' && typeof part.text === 'string' ? [part.text] : [])).join('\n');
}

export const granola: OAuthProvider = {
  id: 'granola',

  authorizeUrl({ credentials, redirectUri, scopes, state, codeChallenge }) {
    const query = new URLSearchParams({
      client_id: credentials.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      resource: GRANOLA_MCP_URL,
    });
    return `${AUTHORIZE_URL}?${query}`;
  },

  exchange(code, credentials, redirectUri, fetchImpl, codeVerifier) {
    return requestTokens(fetchImpl, {
      grant_type: 'authorization_code',
      code,
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    });
  },

  refresh(refreshToken, credentials, fetchImpl) {
    return requestTokens(fetchImpl, {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
    });
  },

  async identify(accessToken, fetchImpl) {
    const listing = await callGranolaTool(fetchImpl, accessToken, 'search_meetings', { limit: 1, max_participants: 0 });
    return ACCOUNT_EMAIL.exec(listing)?.[1] ?? UNKNOWN_ACCOUNT;
  },
};
