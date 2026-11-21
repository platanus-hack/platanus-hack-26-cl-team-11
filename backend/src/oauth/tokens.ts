import type { OAuthTokens } from '../types.js';

const NON_EXPIRING_MS = 10 * 365 * 24 * 60 * 60 * 1000;

export interface TokenGrant {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
}

export const tokensFrom = (accessToken: string, grant: TokenGrant): OAuthTokens => ({
  accessToken,
  refreshToken: grant.refresh_token ?? null,
  expiresAt: Date.now() + (grant.expires_in ? grant.expires_in * 1000 : NON_EXPIRING_MS),
});

export async function readGrant(response: Response): Promise<TokenGrant> {
  try {
    const grant: unknown = await response.json();
    return grant && typeof grant === 'object' ? (grant as TokenGrant) : {};
  } catch {
    return {};
  }
}
