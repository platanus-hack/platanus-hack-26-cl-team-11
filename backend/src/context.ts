import { mkdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { claudeCliConfigFrom, createClaudeCliModel } from './agents/claudeCli.js';
import { openDigestStore, type DigestStore } from './agents/digest.js';
import { createFiftyXModel, fiftyXConfigFrom } from './agents/fiftyx.js';
import { agentModelConfigFrom, createClaudeModel, type AgentModel } from './agents/model.js';
import { openAgentStore, type AgentStore } from './agents/store.js';
import { openAssistantStore, type AssistantStore } from './assistants/store.js';
import { createVault, type Vault } from './crypto.js';
import { openStore, type Store } from './db.js';
import { openHubStore, type HubStore } from './hub/store.js';
import { OAUTH_PROVIDERS } from './oauth/registry.js';
import { openRepoStore, type RepoStore } from './repo/store.js';
import { openRoomStore, type RoomStore } from './rooms/store.js';
import { openSimStore, type SimStore } from './sim/personas.js';
import { openTeamStore, type TeamStore } from './teams/store.js';
import type { Fetch, OAuthCredentials } from './types.js';

export interface HealthShortcut {
  url: string;
  name: string;
}

export interface Config {
  publicBaseUrl: string | null;
  oauth: Record<string, OAuthCredentials | undefined>;
  agentRoundHour?: number | null;
  healthShortcut?: HealthShortcut | null;
}

export interface AppContext {
  db: DatabaseSync;
  store: Store;
  teams: TeamStore;
  hub: HubStore;
  agents: AgentStore;
  rooms: RoomStore;
  assistants: AssistantStore;
  repo: RepoStore;
  digests: DigestStore;
  sim: SimStore;
  model: AgentModel | null;
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

const DEFAULT_AGENT_ROUND_HOUR = 9;
const LAST_HOUR = 23;

const agentRoundHourFrom = (value: string | undefined): number | null => {
  if (value === undefined || value.trim() === '') return DEFAULT_AGENT_ROUND_HOUR;
  const hour = Number(value);
  return Number.isInteger(hour) && hour >= 0 && hour <= LAST_HOUR ? hour : null;
};

const DEFAULT_HEALTH_SHORTCUT_NAME = 'Ronda Salud';
const SECURE_LINK_PREFIX = 'https://';

const healthShortcutFrom = (env: NodeJS.ProcessEnv): HealthShortcut | null => {
  const url = env.HEALTH_SHORTCUT_URL?.trim() ?? '';
  return url.startsWith(SECURE_LINK_PREFIX) ? { url, name: env.HEALTH_SHORTCUT_NAME?.trim() || DEFAULT_HEALTH_SHORTCUT_NAME } : null;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    agentRoundHour: agentRoundHourFrom(env.AGENT_ROUND_HOUR),
    healthShortcut: healthShortcutFrom(env),
    publicBaseUrl: env.PUBLIC_BASE_URL || env.RENDER_EXTERNAL_URL || null,
    oauth: Object.fromEntries(Object.keys(OAUTH_PROVIDERS).map((provider) => [provider, credentialsFrom(env, provider)])),
  };
}

const modelFrom = (env: NodeJS.ProcessEnv, fetchImpl: Fetch): AgentModel | null => {
  const fiftyX = fiftyXConfigFrom(env);
  if (fiftyX) return createFiftyXModel(fiftyX, fetchImpl);
  const cli = claudeCliConfigFrom(env);
  if (cli) return createClaudeCliModel(cli);
  const config = agentModelConfigFrom(env);
  return config ? createClaudeModel(config) : null;
};

export function createContext(options: { location?: string; fetch?: Fetch; config?: Config; model?: AgentModel | null } = {}): AppContext {
  const location = options.location ?? (process.env.DATA_DIR || defaultDataDir());
  const inMemory = location === ':memory:';
  if (!inMemory) mkdirSync(location, { recursive: true });
  const vault = createVault(inMemory ? null : location);
  const db = new DatabaseSync(inMemory ? ':memory:' : join(location, 'ronda.db'));
  const store = openStore(db, vault);
  const teams = openTeamStore(db);
  return {
    db,
    vault,
    store,
    teams,
    hub: openHubStore(db),
    agents: openAgentStore(db),
    rooms: openRoomStore(db),
    assistants: openAssistantStore(db),
    repo: openRepoStore(db),
    digests: openDigestStore(db),
    sim: openSimStore(db),
    model: options.model === undefined ? modelFrom(process.env, options.fetch ?? fetch) : options.model,
    fetch: options.fetch ?? fetch,
    config: options.config ?? loadConfig(),
  };
}
