import { publicIdOf } from '../codes.js';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Hono, type Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { CONNECTORS } from '../connectors/registry.js';
import type { AppContext } from '../context.js';
import { openLoginStore } from '../logins.js';
import { googleProfile } from '../oauth/google.js';
import { OAUTH_PROVIDERS } from '../oauth/registry.js';
import { rateLimit } from '../rateLimit.js';
import { syncSource } from '../sync.js';
import { ConnectorError, type OAuthConnector, type OAuthProvider } from '../types.js';
import { NOT_FOUND } from './shared.js';
import { SESSION_COOKIE, sessionTokenOf } from '../session.js';

const STATE_TTL_MS = 10 * 60 * 1000;
const OWN_PAGE_SITE = 'same-origin';
const NOT_FROM_OWN_PAGE = { error: 'Abre la conexión desde tu página de Montu.' } as const;
const UNKNOWN_PROVIDER = { error: 'Ese proveedor no existe.' } as const;
const INVALID_STATE = { error: 'El enlace de conexión venció o no es válido. Vuelve a intentarlo desde tu página.' } as const;
const MISSING_CODE = { error: 'Falta el código de autorización.' } as const;

interface OAuthState {
  token: string;
  provider: string;
  at: number;
  nonce: string;
  login?: boolean;
  origin?: string;
  invite?: string;
  room?: string;
}

const LOGIN_PROVIDER = 'google';
const LOGIN_SCOPES = ['profile'];
const LOGINS_PER_MINUTE = 30;
const MAX_NAME_LENGTH = 80;
const ACCOUNT_TAKEN = 'Esa cuenta de Google ya abre otra página tuya de Montu que tiene datos. Entra con Google para volver a ella.';
const SESSION_DAYS = 60;
const DAY_SECONDS = 86_400;

const hashOf = (nonce: string) => createHash('sha256').update(nonce).digest('hex');
const challengeOf = (verifier: string) => createHash('sha256').update(verifier).digest('base64url');

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
  const logins = openLoginStore(ctx.db);
  const limitedLogins = rateLimit(LOGINS_PER_MINUTE);

  const credentialsOf = (provider: string) => (Object.hasOwn(config.oauth, provider) ? config.oauth[provider] : undefined);

  const consumedNonces = new Map<string, number>();

  const baseUrlFor = (requestUrl: string) => (config.publicBaseUrl ?? new URL(requestUrl).origin).replace(/\/+$/, '');
  const callbackPathOf = (provider: string) => `/api/oauth/${provider}/callback`;
  const redirectUriFor = (requestUrl: string, provider: string) => `${baseUrlFor(requestUrl)}${callbackPathOf(provider)}`;
  const cookieNameOf = (provider: string) => `ronda_oauth_${provider}`;
  const cookiePlaceOf = (requestUrl: string, provider: string) => ({ path: callbackPathOf(provider), secure: baseUrlFor(requestUrl).startsWith('https:') });

  const requestOriginOf = (c: Context) => {
    const url = new URL(c.req.url);
    const forwardedProto = c.req.header('x-forwarded-proto')?.split(',')[0]?.trim();
    const host = c.req.header('host') ?? url.host;
    return `${forwardedProto ? `${forwardedProto}:` : url.protocol}//${host}`;
  };

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
      return { token: state.token, provider: state.provider, at: state.at, nonce: state.nonce, login: state.login === true, origin: typeof state.origin === 'string' ? state.origin : undefined };
    } catch {
      return null;
    }
  };

  const startLogin = (c: Context, personToken: string, door: { invite?: string; room?: string } = {}) => {
    const provider = findProvider(LOGIN_PROVIDER);
    const credentials = credentialsOf(LOGIN_PROVIDER);
    if (!provider || !credentials) return c.json(missingCredentials(LOGIN_PROVIDER), 500);
    const nonce = randomBytes(32).toString('base64url');
    const authorizeUrl = provider.authorizeUrl({
      credentials,
      redirectUri: redirectUriFor(c.req.url, LOGIN_PROVIDER),
      scopes: LOGIN_SCOPES,
      state: vault.seal(JSON.stringify({ token: personToken, provider: LOGIN_PROVIDER, at: Date.now(), nonce: hashOf(nonce), login: true, origin: requestOriginOf(c), ...door } satisfies OAuthState)),
      codeChallenge: challengeOf(nonce),
      login: true,
    });
    setCookie(c, cookieNameOf(LOGIN_PROVIDER), nonce, { ...cookiePlaceOf(c.req.url, LOGIN_PROVIDER), httpOnly: true, sameSite: 'Lax', maxAge: STATE_TTL_MS / 1000 });
    return c.redirect(authorizeUrl, 302);
  };

  const sessionPlace = (requestUrl: string) => ({ path: '/', secure: baseUrlFor(requestUrl).startsWith('https:') });

  const openSession = (c: Context, personToken: string) =>
    setCookie(c, SESSION_COOKIE, vault.seal(JSON.stringify({ token: personToken })), { ...sessionPlace(c.req.url), httpOnly: true, sameSite: 'Lax', maxAge: SESSION_DAYS * DAY_SECONDS });

  const sessionPerson = (c: Context) => {
    const personToken = sessionTokenOf(c, vault);
    return personToken ? store.findPerson(personToken) : undefined;
  };

  const hasNothing = (personToken: string) =>
    store.listConnections(personToken).length === 0 &&
    Object.keys(store.syncBySource(personToken)).length === 0 &&
    ctx.teams.teamsOf(personToken).length === 0 &&
    ctx.assistants.assistantsOf(personToken).length === 0 &&
    ctx.repo.tree(personToken).length === 0;

  const finishLogin = async (c: Context, state: OAuthState, code: string, nonce: string) => {
    const provider = findProvider(LOGIN_PROVIDER);
    const credentials = credentialsOf(LOGIN_PROVIDER);
    if (!provider || !credentials) return c.json(missingCredentials(LOGIN_PROVIDER), 500);
    const tokens = await provider.exchange(code, credentials, redirectUriFor(c.req.url, LOGIN_PROVIDER), ctx.fetch, nonce);
    const profile = await googleProfile(tokens.accessToken, ctx.fetch);
    const mappedToken = logins.personOf(profile.email);
    const mapped = mappedToken ? store.findPerson(mappedToken) : undefined;
    const asking = state.token ? store.findPerson(state.token) : undefined;

    if (asking) {
      const page = `/conectar/${asking.token}`;
      if (mapped && mapped.token !== asking.token && !hasNothing(mapped.token)) return c.redirect(`${page}?aviso=${encodeURIComponent(ACCOUNT_TAKEN)}#ajustes`, 302);
      logins.assign(profile.email, asking.token, profile.name);
      openSession(c, asking.token);
      return c.redirect(`${page}#ajustes`, 302);
    }

    const connected = store.findPeopleByAccount(profile.email).flatMap((token) => store.findPerson(token) ?? [])[0];
    const person =
      (mapped && !hasNothing(mapped.token) ? mapped : undefined) ??
      connected ??
      mapped ??
      store.addPerson((profile.name ?? profile.email.split('@')[0] ?? profile.email).slice(0, MAX_NAME_LENGTH));
    logins.assign(profile.email, person.token, profile.name);
    openSession(c, person.token);
    const invited = state.invite ? ctx.teams.findInvite(state.invite, new Date())?.teamId : undefined;
    const roomTeam = state.room ? ctx.rooms.findRoom(state.room)?.teamId : undefined;
    const teamId = invited ?? roomTeam;
    if (teamId && ctx.teams.findTeam(teamId) && !ctx.teams.isMember(teamId, person.token)) {
      ctx.teams.addMember(teamId, person.token);
      if (roomTeam === teamId) ctx.rooms.record(teamId, 'persona_entra', { person: publicIdOf(person.token), name: person.name });
    }
    return c.redirect(`/conectar/${person.token}${teamId ? '#equipo' : ''}`, 302);
  };

  routes.get('/session', (c) => {
    const person = sessionPerson(c);
    return c.json({ person: person ? { token: person.token, name: person.name } : null });
  });

  routes.post('/session/logout', (c) => {
    deleteCookie(c, SESSION_COOKIE, sessionPlace(c.req.url));
    return c.json({ ok: true });
  });

  routes.get('/login', (c) => c.json({ google: credentialsOf(LOGIN_PROVIDER) !== undefined }));

  routes.get('/login/google/start', limitedLogins, (c) => {
    const invite = c.req.query('invitacion');
    const room = c.req.query('sala');
    return startLogin(c, '', { ...(invite && ctx.teams.findInvite(invite, new Date()) ? { invite } : {}), ...(room && ctx.rooms.findRoom(room) ? { room } : {}) });
  });

  routes.get('/people/:token/login/google/start', (c) => {
    if (!startedFromOwnPage(c)) return c.json(NOT_FROM_OWN_PAGE, 403);
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json(NOT_FOUND, 404);
    return startLogin(c, person.token);
  });

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
      state: vault.seal(JSON.stringify({ token: person.token, provider: providerId, at: Date.now(), nonce: hashOf(nonce), origin: requestOriginOf(c) } satisfies OAuthState)),
      codeChallenge: challengeOf(nonce),
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
    if (state.origin && state.origin !== requestOriginOf(c)) {
      const here = new URL(c.req.url);
      return c.redirect(`${state.origin}${here.pathname}${here.search}`, 302);
    }
    const nonce = getCookie(c, cookieNameOf(providerId));
    deleteCookie(c, cookieNameOf(providerId), cookiePlaceOf(c.req.url, providerId));
    if (!nonce || !sameHash(hashOf(nonce), state.nonce) || !consumeNonce(state.nonce)) return c.json(INVALID_STATE, 400);
    if (state.login) {
      const loginCode = c.req.query('code');
      if (c.req.query('error') || !loginCode) return c.redirect(state.token ? `/conectar/${state.token}#ajustes` : '/', 302);
      try {
        return await finishLogin(c, state, loginCode, nonce);
      } catch (failure) {
        if (!(failure instanceof ConnectorError)) throw failure;
        return c.redirect(`/?aviso=${encodeURIComponent(failure.message)}`, 302);
      }
    }
    const person = store.findPerson(state.token);
    if (!person) return c.json(NOT_FOUND, 404);
    const personPage = `/conectar/${person.token}`;
    if (c.req.query('error')) return c.redirect(personPage, 302);
    const code = c.req.query('code');
    if (!code) return c.json(MISSING_CODE, 400);
    const credentials = credentialsOf(providerId);
    if (!credentials) return c.json(missingCredentials(providerId), 500);

    try {
      const tokens = await provider.exchange(code, credentials, redirectUriFor(c.req.url, providerId), ctx.fetch, nonce);
      const account = await provider.identify(tokens.accessToken, ctx.fetch);
      for (const connector of connectorsOf(providerId)) {
        store.saveConnection(person.token, connector.id, account, JSON.stringify(tokens));
        if (providerId === LOGIN_PROVIDER && logins.link(account, person.token) !== 'de_otra_persona') openSession(c, person.token);
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
