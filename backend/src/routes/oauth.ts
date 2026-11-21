import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Hono, type Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { CONNECTORS } from '../connectors/registry.js';
import type { AppContext } from '../context.js';
import { OAUTH_PROVIDERS } from '../oauth/registry.js';
import { syncSource } from '../sync.js';
import { ConnectorError, type OAuthConnector, type OAuthProvider } from '../types.js';
import { NOT_FOUND } from './shared.js';

const STATE_TTL_MS = 10 * 60 * 1000;
const OWN_PAGE_SITE = 'same-origin';
const NOT_FROM_OWN_PAGE = { error: 'Abre la conexión desde tu página de Ronda.' } as const;
const UNKNOWN_PROVIDER = { error: 'Ese proveedor no existe.' } as const;
const INVALID_STATE = { error: 'El enlace de conexión venció o no es válido. Vuelve a intentarlo desde tu página.' } as const;
const MISSING_CODE = { error: 'Falta el código de autorización.' } as const;

interface OAuthState {
  token: string;
  provider: string;
  at: number;
  nonce: string;
}

const hashOf = (nonce: string) => createHash('sha256').update(nonce).digest('hex');

const sameHash = (left: string, right: string) => {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
};

const originOf = (url: string | undefined | null): string | null => {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
};

const findProvider = (id: string): OAuthProvider | undefined => (Object.hasOwn(OAUTH_PROVIDERS, id) ? OAUTH_PROVIDERS[id] : undefined);

const connectorsOf = (provider: string): OAuthConnector[] =>
  CONNECTORS.filter((connector): connector is OAuthConnector => connector.kind === 'oauth' && connector.provider === provider);

const missingCredentials = (provider: string) => {
  const prefix = provider.toUpperCase();
  return { error: `Falta configurar ${provider} en el servidor: define ${prefix}_CLIENT_ID y ${prefix}_CLIENT_SECRET.` };
};

export function oauthRoutes(ctx: AppContext) {
  const routes = new Hono();
  const { store, vault, config } = ctx;

  const credentialsOf = (provider: string) => (Object.hasOwn(config.oauth, provider) ? config.oauth[provider] : undefined);

  const consumedNonces = new Map<string, number>();

  const baseUrlFor = (requestUrl: string) => (config.publicBaseUrl ?? new URL(requestUrl).origin).replace(/\/+$/, '');
  const callbackPathOf = (provider: string) => `/api/oauth/${provider}/callback`;
  const redirectUriFor = (requestUrl: string, provider: string) => `${baseUrlFor(requestUrl)}${callbackPathOf(provider)}`;
  const cookieNameOf = (provider: string) => `ronda_oauth_${provider}`;
  const cookiePlaceOf = (requestUrl: string, provider: string) => ({ path: callbackPathOf(provider), secure: baseUrlFor(requestUrl).startsWith('https:') });

  const startedFromOwnPage = (c: Context) => {
    const site = c.req.header('sec-fetch-site');
    if (site !== undefined) return site === OWN_PAGE_SITE;
    const source = originOf(c.req.header('origin') ?? c.req.header('referer'));
    return source !== null && [originOf(c.req.url), originOf(config.publicBaseUrl)].includes(source);
  };

  const consumeNonce = (nonce: string): boolean => {
    const now = Date.now();
    for (const [known, expiresAt] of consumedNonces) if (expiresAt <= now) consumedNonces.delete(known);
    if (consumedNonces.has(nonce)) return false;
    consumedNonces.set(nonce, now + STATE_TTL_MS);
    return true;
  };

  const openState = (sealed: string | undefined, provider: string): OAuthState | null => {
    if (!sealed) return null;
    try {
      const state = JSON.parse(vault.open(sealed)) as Partial<OAuthState> | null;
      if (typeof state?.token !== 'string' || typeof state.at !== 'number' || typeof state.nonce !== 'string' || state.provider !== provider) return null;
      if (Date.now() - state.at > STATE_TTL_MS) return null;
      return { token: state.token, provider: state.provider, at: state.at, nonce: state.nonce };
    } catch {
      return null;
    }
  };

  routes.get('/people/:token/oauth/:provider/start', (c) => {
    if (!startedFromOwnPage(c)) return c.json(NOT_FROM_OWN_PAGE, 403);
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json(NOT_FOUND, 404);
    const providerId = c.req.param('provider');
    const provider = findProvider(providerId);
    if (!provider) return c.json(UNKNOWN_PROVIDER, 400);
    const credentials = credentialsOf(providerId);
    if (!credentials) return c.json(missingCredentials(providerId), 500);
    const nonce = randomBytes(32).toString('base64url');
    const authorizeUrl = provider.authorizeUrl({
      credentials,
      redirectUri: redirectUriFor(c.req.url, providerId),
      scopes: [...new Set(connectorsOf(providerId).flatMap((connector) => connector.scopes))],
      state: vault.seal(JSON.stringify({ token: person.token, provider: providerId, at: Date.now(), nonce: hashOf(nonce) } satisfies OAuthState)),
    });
    setCookie(c, cookieNameOf(providerId), nonce, { ...cookiePlaceOf(c.req.url, providerId), httpOnly: true, sameSite: 'Lax', maxAge: STATE_TTL_MS / 1000 });
    return c.redirect(authorizeUrl, 302);
  });

  routes.get('/oauth/:provider/callback', async (c) => {
    const providerId = c.req.param('provider');
    const provider = findProvider(providerId);
    if (!provider) return c.json(UNKNOWN_PROVIDER, 400);
    const state = openState(c.req.query('state'), providerId);
    if (!state) return c.json(INVALID_STATE, 400);
    const nonce = getCookie(c, cookieNameOf(providerId));
    deleteCookie(c, cookieNameOf(providerId), cookiePlaceOf(c.req.url, providerId));
    if (!nonce || !sameHash(hashOf(nonce), state.nonce) || !consumeNonce(state.nonce)) return c.json(INVALID_STATE, 400);
    const person = store.findPerson(state.token);
    if (!person) return c.json(NOT_FOUND, 404);
    const personPage = `/conectar/${person.token}`;
    if (c.req.query('error')) return c.redirect(personPage, 302);
    const code = c.req.query('code');
    if (!code) return c.json(MISSING_CODE, 400);
    const credentials = credentialsOf(providerId);
    if (!credentials) return c.json(missingCredentials(providerId), 500);

    try {
      const tokens = await provider.exchange(code, credentials, redirectUriFor(c.req.url, providerId), ctx.fetch);
      const account = await provider.identify(tokens.accessToken, ctx.fetch);
      for (const connector of connectorsOf(providerId)) {
        store.saveConnection(person.token, connector.id, account, JSON.stringify(tokens));
        await syncSource(ctx, person.token, connector.id).catch(() => undefined);
      }
      return c.redirect(personPage, 302);
    } catch (failure) {
      if (!(failure instanceof ConnectorError)) throw failure;
      return c.redirect(`${personPage}?aviso=${encodeURIComponent(failure.message)}`, 302);
    }
  });

  return routes;
}
