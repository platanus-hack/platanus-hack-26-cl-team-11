import { ConnectorError, type Fetch, type OAuthProvider, type OAuthTokens } from '../types.js';

const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';
const IDENTITY_SCOPES = ['openid', 'email'];

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
}

async function send(fetchImpl: Fetch, url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetchImpl(url, init);
  } catch {
    throw new ConnectorError('No se pudo contactar a Google.');
  }
}

async function requestTokens(fetchImpl: Fetch, form: Record<string, string>): Promise<OAuthTokens> {
  const response = await send(fetchImpl, TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: new URLSearchParams(form).toString(),
  });
  if (response.status === 400) throw new ConnectorError('Google no aceptó la autorización. Vuelve a conectar tu cuenta.', 400);
  if (response.status === 401) throw new ConnectorError('Google rechazó las credenciales del servidor.', 500);
  if (!response.ok) throw new ConnectorError(`Google respondió ${response.status}.`);
  const tokens = (await response.json()) as TokenResponse;
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
    expiresAt: Date.now() + tokens.expires_in * 1000,
  };
}

export async function getGoogleJson<T>(fetchImpl: Fetch, url: string, accessToken: string, service: string): Promise<T> {
  const response = await send(fetchImpl, url, { headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' } });
  if (response.status === 401) throw new ConnectorError('Google dio por vencido el acceso. Vuelve a conectar tu cuenta.', 400);
  if (response.status === 403) throw new ConnectorError(`Google no permitió leer ${service}. Vuelve a conectar y acepta todos los permisos.`, 400);
  if (response.status === 429) throw new ConnectorError(`${service} pidió esperar antes de reintentar.`, 429);
  if (!response.ok) throw new ConnectorError(`${service} respondió ${response.status}.`);
  return (await response.json()) as T;
}

export interface GoogleProfile {
  email: string;
  name: string | null;
}

export async function googleProfile(accessToken: string, fetchImpl: Fetch): Promise<GoogleProfile> {
  const profile = await getGoogleJson<{ email?: string; name?: string }>(fetchImpl, USERINFO_URL, accessToken, 'tu cuenta de Google');
  if (!profile.email) throw new ConnectorError('Google no entregó el correo de la cuenta.');
  return { email: profile.email, name: profile.name?.trim() || null };
}

export const google: OAuthProvider = {
  id: 'google',

  authorizeUrl({ credentials, redirectUri, scopes, state }) {
    const query = new URLSearchParams({
      client_id: credentials.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: [...new Set([...IDENTITY_SCOPES, ...scopes])].join(' '),
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state,
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
    const profile = await getGoogleJson<{ email?: string }>(fetchImpl, USERINFO_URL, accessToken, 'tu cuenta de Google');
    if (!profile.email) throw new ConnectorError('Google no entregó el correo de la cuenta.');
    return profile.email;
  },
};
