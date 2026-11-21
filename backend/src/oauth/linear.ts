import { ConnectorError, type Fetch, type OAuthProvider, type OAuthTokens } from '../types.js';
import { readGrant, tokensFrom } from './tokens.js';

const AUTHORIZE_URL = 'https://linear.app/oauth/authorize';
const TOKEN_URL = 'https://api.linear.app/oauth/token';
const GRAPHQL_URL = 'https://api.linear.app/graphql';
const AUTHENTICATION_ERROR_CODE = 'AUTHENTICATION_ERROR';
const AUTHENTICATION_ERROR_TYPE = 'authentication error';
const RATE_LIMIT_ERROR_CODE = 'RATELIMITED';
const VIEWER_QUERY = 'query RondaViewer { viewer { email } }';

interface GraphqlError {
  message?: string;
  extensions?: { code?: string; type?: string };
}

interface GraphqlBody<T> {
  data?: T | null;
  errors?: GraphqlError[];
}

const hasErrorCode = (errors: GraphqlError[], code: string) => errors.some((error) => error.extensions?.code === code);
const isAuthenticationFailure = (errors: GraphqlError[]) =>
  hasErrorCode(errors, AUTHENTICATION_ERROR_CODE) || errors.some((error) => error.extensions?.type === AUTHENTICATION_ERROR_TYPE);

async function send(fetchImpl: Fetch, url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetchImpl(url, init);
  } catch {
    throw new ConnectorError('No se pudo contactar a Linear.');
  }
}

async function readBody<T>(response: Response): Promise<GraphqlBody<T>> {
  try {
    return (await response.json()) as GraphqlBody<T>;
  } catch {
    return {};
  }
}

async function requestTokens(fetchImpl: Fetch, form: Record<string, string>): Promise<OAuthTokens> {
  const response = await send(fetchImpl, TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: new URLSearchParams(form).toString(),
  });
  const grant = await readGrant(response);
  if (response.status === 401) throw new ConnectorError('Linear rechazó las credenciales del servidor.', 500);
  if (response.status === 400 || grant.error) throw new ConnectorError('Linear no aceptó la autorización. Vuelve a conectar tu cuenta.', 400);
  if (!response.ok) throw new ConnectorError(`Linear respondió ${response.status}.`);
  if (!grant.access_token) throw new ConnectorError('Linear respondió sin acceso.');
  return tokensFrom(grant.access_token, grant);
}

export async function postLinearGraphql<T>(fetchImpl: Fetch, accessToken: string, query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const response = await send(fetchImpl, GRAPHQL_URL, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const body = await readBody<T>(response);
  const errors = body.errors ?? [];
  if (response.status === 401 || response.status === 403 || isAuthenticationFailure(errors)) {
    throw new ConnectorError('Linear dio por vencido el acceso. Vuelve a conectar tu cuenta.', 400);
  }
  if (response.status === 429 || hasErrorCode(errors, RATE_LIMIT_ERROR_CODE)) throw new ConnectorError('Linear pidió esperar antes de reintentar.', 429);
  if (!response.ok) throw new ConnectorError(`Linear respondió ${response.status}.`);
  if (errors.length > 0) throw new ConnectorError(`Linear rechazó el pedido: ${errors[0]?.message ?? 'sin detalle'}.`);
  if (!body.data) throw new ConnectorError('Linear respondió sin datos.');
  return body.data;
}

export const linear: OAuthProvider = {
  id: 'linear',

  authorizeUrl({ credentials, redirectUri, scopes, state }) {
    const query = new URLSearchParams({
      client_id: credentials.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes.join(','),
      state,
      prompt: 'consent',
    });
    return `${AUTHORIZE_URL}?${query}`;
  },

  exchange(code, credentials, redirectUri, fetchImpl) {
    return requestTokens(fetchImpl, {
      grant_type: 'authorization_code',
      code,
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      redirect_uri: redirectUri,
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
    const { viewer } = await postLinearGraphql<{ viewer?: { email?: string } }>(fetchImpl, accessToken, VIEWER_QUERY);
    if (!viewer?.email) throw new ConnectorError('Linear no entregó el correo de la cuenta.');
    return viewer.email;
  },
};
