import { Hono } from 'hono';
import { CONNECTORS } from '../connectors/registry.js';
import type { AppContext } from '../context.js';
import { OAUTH_PROVIDERS } from '../oauth/registry.js';
import { syncSource } from '../sync.js';
import { ConnectorError, type OAuthConnector, type OAuthProvider } from '../types.js';
import { NOT_FOUND } from './shared.js';

const STATE_TTL_MS = 10 * 60 * 1000;
const UNKNOWN_PROVIDER = { error: 'Ese proveedor no existe.' } as const;
const INVALID_STATE = { error: 'El enlace de conexión venció o no es válido. Vuelve a intentarlo desde tu página.' } as const;
const MISSING_CODE = { error: 'Falta el código de autorización.' } as const;

interface OAuthState {
  token: string;
  provider: string;
  at: number;
}

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

  const redirectUriFor = (requestUrl: string, provider: string) =>
    `${(config.publicBaseUrl ?? new URL(requestUrl).origin).replace(/\/+$/, '')}/api/oauth/${provider}/callback`;

  const openState = (sealed: string | undefined, provider: string): OAuthState | null => {
    if (!sealed) return null;
    try {
      const state = JSON.parse(vault.open(sealed)) as Partial<OAuthState> | null;
      if (typeof state?.token !== 'string' || typeof state.at !== 'number' || state.provider !== provider) return null;
      if (Date.now() - state.at > STATE_TTL_MS) return null;
      return { token: state.token, provider: state.provider, at: state.at };
    } catch {
      return null;
    }
  };

  routes.get('/people/:token/oauth/:provider/start', (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json(NOT_FOUND, 404);
    const providerId = c.req.param('provider');
    const provider = findProvider(providerId);
    if (!provider) return c.json(UNKNOWN_PROVIDER, 400);
    const credentials = credentialsOf(providerId);
    if (!credentials) return c.json(missingCredentials(providerId), 500);
    const authorizeUrl = provider.authorizeUrl({
      credentials,
      redirectUri: redirectUriFor(c.req.url, providerId),
      scopes: [...new Set(connectorsOf(providerId).flatMap((connector) => connector.scopes))],
      state: vault.seal(JSON.stringify({ token: person.token, provider: providerId, at: Date.now() } satisfies OAuthState)),
    });
    return c.redirect(authorizeUrl, 302);
  });

  routes.get('/oauth/:provider/callback', async (c) => {
    const providerId = c.req.param('provider');
    const provider = findProvider(providerId);
    if (!provider) return c.json(UNKNOWN_PROVIDER, 400);
    const state = openState(c.req.query('state'), providerId);
    if (!state) return c.json(INVALID_STATE, 400);
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
