import { mkdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createVault, type Vault } from './crypto.js';
import { openStore, type Store } from './db.js';
import { openHubStore, type HubStore } from './hub/store.js';
import { OAUTH_PROVIDERS } from './oauth/registry.js';
import { openTeamStore, type TeamStore } from './teams/store.js';
import type { Fetch, OAuthCredentials } from './types.js';

export interface Config {
  publicBaseUrl: string | null;
  oauth: Record<string, OAuthCredentials | undefined>;
}

export interface AppContext {
  db: DatabaseSync;
  store: Store;
  teams: TeamStore;
  hub: HubStore;
  vault: Vault;
  fetch: Fetch;
  config: Config;
}

const defaultDataDir = () => join(dirname(fileURLToPath(import.meta.url)), '..', 'data');

const credentialsFrom = (env: NodeJS.ProcessEnv, provider: string): OAuthCredentials | undefined => {
  const prefix = provider.toUpperCase();
  const clientId = env[`${prefix}_CLIENT_ID`];
  const clientSecret = env[`${prefix}_CLIENT_SECRET`];
  return clientId && clientSecret ? { clientId, clientSecret } : undefined;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    publicBaseUrl: env.PUBLIC_BASE_URL || env.RENDER_EXTERNAL_URL || null,
    oauth: Object.fromEntries(Object.keys(OAUTH_PROVIDERS).map((provider) => [provider, credentialsFrom(env, provider)])),
  };
}

export function createContext(options: { location?: string; fetch?: Fetch; config?: Config } = {}): AppContext {
  const location = options.location ?? (process.env.DATA_DIR || defaultDataDir());
  const inMemory = location === ':memory:';
  if (!inMemory) mkdirSync(location, { recursive: true });
  const vault = createVault(inMemory ? null : location);
  const db = new DatabaseSync(inMemory ? ':memory:' : join(location, 'ronda.db'));
  const store = openStore(db, vault);
  return {
    db,
    vault,
    store,
    teams: openTeamStore(db),
    hub: openHubStore(db),
    fetch: options.fetch ?? fetch,
    config: options.config ?? loadConfig(),
  };
}
