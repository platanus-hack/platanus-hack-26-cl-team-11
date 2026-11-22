import type { Context, MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import type { AppContext } from './context.js';
import type { Vault } from './crypto.js';
import { openLoginStore } from './logins.js';

export const SESSION_COOKIE = 'montu_sesion';
export const SIGN_IN_REQUIRED = { error: 'Esta página tiene cuenta de Google. Entra con Google para abrirla.', signIn: 'google' } as const;
const SIGN_IN_REQUIRED_STATUS = 401;

export function sessionTokenOf(c: Context, vault: Vault): string | null {
  const sealed = getCookie(c, SESSION_COOKIE);
  if (!sealed) return null;
  try {
    const session = JSON.parse(vault.open(sealed)) as { token?: unknown } | null;
    return typeof session?.token === 'string' ? session.token : null;
  } catch {
    return null;
  }
}

export function pageGuard({ db, vault, config }: Pick<AppContext, 'db' | 'vault' | 'config'>) {
  const logins = openLoginStore(db);
  const mayActAs = (c: Context, personToken: string) =>
    config.oauth.google === undefined || logins.loginOf(personToken) === undefined || sessionTokenOf(c, vault) === personToken;
  const ownerOnly: MiddlewareHandler = async (c, next) => {
    const personToken = c.req.param('token');
    if (personToken && !mayActAs(c, personToken)) return c.json(SIGN_IN_REQUIRED, SIGN_IN_REQUIRED_STATUS);
    await next();
  };
  return { mayActAs, ownerOnly };
}
