import { ConnectorError, type Fetch, type OAuthProvider, type OAuthTokens } from '../types.js';
import { readGrant, tokensFrom } from './tokens.js';

const AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const TOKEN_URL = 'https://github.com/login/oauth/access_token';
const API_URL = 'https://api.github.com';
const USER_AGENT = 'ronda-hack';
const SERVER_CREDENTIALS_ERROR = 'incorrect_client_credentials';

async function send(fetchImpl: Fetch, url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetchImpl(url, init);
  } catch {
    throw new ConnectorError('No se pudo contactar a GitHub.');
  }
}

async function requestTokens(fetchImpl: Fetch, form: Record<string, string>): Promise<OAuthTokens> {
  const response = await send(fetchImpl, TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json', 'user-agent': USER_AGENT },
    body: new URLSearchParams(form).toString(),
  });
  const grant = await readGrant(response);
  if (grant.error === SERVER_CREDENTIALS_ERROR || response.status === 401) throw new ConnectorError('GitHub rechazó las credenciales del servidor.', 500);
  if (grant.error || response.status === 400) throw new ConnectorError('GitHub no aceptó la autorización. Vuelve a conectar tu cuenta.', 400);
  if (!response.ok) throw new ConnectorError(`GitHub respondió ${response.status}.`);
  if (!grant.access_token) throw new ConnectorError('GitHub respondió sin acceso.');
  return tokensFrom(grant.access_token, grant);
}

export async function getGithubJson<T>(fetchImpl: Fetch, path: string, accessToken: string): Promise<T> {
  const response = await send(fetchImpl, `${API_URL}${path}`, {
    headers: { authorization: `Bearer ${accessToken}`, accept: 'application/vnd.github+json', 'user-agent': USER_AGENT },
  });
  if (response.status === 401) throw new ConnectorError('GitHub dio por vencido el acceso. Vuelve a conectar tu cuenta.', 400);
  if (response.status === 429 || (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0')) {
    throw new ConnectorError('GitHub pidió esperar antes de reintentar.', 429);
  }
  if (response.status === 403) throw new ConnectorError('GitHub no permitió leer tu actividad. Vuelve a conectar y acepta los permisos.', 400);
  if (!response.ok) throw new ConnectorError(`GitHub respondió ${response.status}.`);
  return (await response.json()) as T;
}

export const github: OAuthProvider = {
  id: 'github',

  authorizeUrl({ credentials, redirectUri, scopes, state }) {
    const query = new URLSearchParams({
      client_id: credentials.clientId,
      redirect_uri: redirectUri,
      scope: scopes.join(' '),
      state,
    });
    return `${AUTHORIZE_URL}?${query}`;
  },

  exchange(code, credentials, redirectUri, fetchImpl) {
    return requestTokens(fetchImpl, {
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      code,
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
    const user = await getGithubJson<{ login?: string }>(fetchImpl, '/user', accessToken);
    if (!user.login) throw new ConnectorError('GitHub no entregó el nombre de la cuenta.');
    return user.login;
  },
};
