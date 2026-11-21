import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createVault, type Vault } from './crypto.js';
import { openStore, type Store } from './db.js';
import type { Fetch, OAuthCredentials } from './types.js';

export interface Config {
  publicBaseUrl: string | null;
  oauth: Record<string, OAuthCredentials | undefined>;
}

export interface AppContext {
  store: Store;
  vault: Vault;
  fetch: Fetch;
  config: Config;
}

const defaultDataDir = () => join(dirname(fileURLToPath(import.meta.url)), '..', 'data');

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const google = env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET ? { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } : undefined;
  return { publicBaseUrl: env.PUBLIC_BASE_URL || null, oauth: { google } };
}

export function createContext(options: { location?: string; fetch?: Fetch; config?: Config } = {}): AppContext {
  const location = options.location ?? (process.env.DATA_DIR || defaultDataDir());
  const inMemory = location === ':memory:';
  if (!inMemory) mkdirSync(location, { recursive: true });
  const vault = createVault(inMemory ? null : location);
  return {
    vault,
    store: openStore(inMemory ? ':memory:' : join(location, 'ronda.db'), vault),
    fetch: options.fetch ?? fetch,
    config: options.config ?? loadConfig(),
  };
}
