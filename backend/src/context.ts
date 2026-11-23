import { mkdirSync } from 'node:fs';
import { openDatabase, type DatabaseSync } from './pg/database.js';
import { openSqlite } from './pg/sqlite.js';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { claudeCliConfigFrom, createClaudeCliModel } from './agents/claudeCli.js';
import { openDigestStore, type DigestStore } from './agents/digest.js';
import { createFiftyXModel, fiftyXConfigFrom } from './agents/fiftyx.js';
import { agentModelConfigFrom, createClaudeModel, type AgentModel } from './agents/model.js';
import { openAgentStore, type AgentStore } from './agents/store.js';
import { openAssistantStore, type AssistantStore } from './assistants/store.js';
import { createVault, type Vault } from './crypto.js';
import { createLiveTexts, type LiveTexts } from './mesa/live.js';
import { DEFAULT_MESA_DAILY_TOKEN_CAP, DEFAULT_MESA_OPERATORS, openMesaStore, type MesaStore } from './mesa/store.js';
import { openStore, type Store } from './db.js';
import { openHubStore, type HubStore } from './hub/store.js';
import { OAUTH_PROVIDERS } from './oauth/registry.js';
import { openRepoStore, type RepoStore } from './repo/store.js';
import { openRoomStore, type RoomStore } from './rooms/store.js';
import { openSimStore, type SimStore } from './sim/personas.js';
import { openTeamStore, type TeamStore } from './teams/store.js';
import type { Fetch, OAuthCredentials } from './types.js';
import { createWhatsAppBridge, SILENT_BRIDGE, type WhatsAppBridge } from './whatsapp/bridge.js';
import { createKapsoChannel, kapsoConfigFrom, type WhatsAppChannel } from './whatsapp/kapso.js';
import { openWhatsAppStore } from './whatsapp/store.js';

export interface HealthShortcut {
  url: string;
  name: string;
}

export interface Config {
  publicBaseUrl: string | null;
  oauth: Record<string, OAuthCredentials | undefined>;
  agentRoundHour?: number | null;
  healthShortcut?: HealthShortcut | null;
  mesaOperators?: string[];
  mesaDailyTokenCap?: number;
  mesaMemoMs?: number;
  nudges?: boolean;
}

export interface AppContext {
  db: DatabaseSync;
  store: Store;
  teams: TeamStore;
  hub: HubStore;
  agents: AgentStore;
  rooms: RoomStore;
  mesa: MesaStore;
  mesaLive: LiveTexts;
  assistants: AssistantStore;
  repo: RepoStore;
  digests: DigestStore;
  sim: SimStore;
  model: AgentModel | null;
  whatsapp: WhatsAppBridge;
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

const MESA_MEMO_MS = 5000;

const mesaOperatorsFrom = (value: string | undefined): string[] => {
  const emails = (value ?? '').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean);
  return emails.length > 0 ? emails : [...DEFAULT_MESA_OPERATORS];
};

const mesaDailyTokenCapFrom = (value: string | undefined): number => {
  const cap = Number(value);
  return value !== undefined && value.trim() !== '' && Number.isFinite(cap) && cap >= 0 ? Math.floor(cap) : DEFAULT_MESA_DAILY_TOKEN_CAP;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    mesaOperators: mesaOperatorsFrom(env.MESA_OPERATORS),
    mesaDailyTokenCap: mesaDailyTokenCapFrom(env.MESA_DAILY_TOKEN_CAP),
    mesaMemoMs: MESA_MEMO_MS,
    nudges: env.NUDGES?.trim().toLowerCase() !== 'off',
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

const channelFrom = (env: NodeJS.ProcessEnv, fetchImpl: Fetch): WhatsAppChannel | null => {
  const config = kapsoConfigFrom(env);
  return config ? createKapsoChannel(config, fetchImpl) : null;
};

export const SQLITE_FILE = 'ronda.db';

export const dataLocation = (env: NodeJS.ProcessEnv = process.env): string => env.DATA_DIR || defaultDataDir();

function openDatabaseAt(location: string, env: NodeJS.ProcessEnv): DatabaseSync {
  if (location === ':memory:') return openDatabase({ kind: 'memory' });
  const url = env.DATABASE_URL?.trim();
  return url ? openDatabase({ kind: 'postgres', url }) : openSqlite(join(location, SQLITE_FILE));
}

export function createContext(options: { location?: string; fetch?: Fetch; config?: Config; model?: AgentModel | null; whatsapp?: WhatsAppChannel | null } = {}): AppContext {
  const location = options.location ?? dataLocation();
  const inMemory = location === ':memory:';
  const onPostgres = !inMemory && Boolean(process.env.DATABASE_URL?.trim());
  if (!inMemory && !onPostgres) mkdirSync(location, { recursive: true });
  const vault = createVault(inMemory ? null : location);
  const db = openDatabaseAt(location, process.env);
  const store = openStore(db, vault);
  const teams = openTeamStore(db);
  const ctx: AppContext = {
    db,
    vault,
    store,
    teams,
    hub: openHubStore(db),
    agents: openAgentStore(db),
    rooms: openRoomStore(db),
    mesa: openMesaStore(db),
    mesaLive: createLiveTexts(),
    assistants: openAssistantStore(db),
    repo: openRepoStore(db),
    digests: openDigestStore(db),
    sim: openSimStore(db),
    model: options.model === undefined ? modelFrom(process.env, options.fetch ?? fetch) : options.model,
    fetch: options.fetch ?? fetch,
    config: options.config ?? loadConfig(),
    whatsapp: SILENT_BRIDGE,
  };
  const channel = options.whatsapp === undefined ? channelFrom(process.env, options.fetch ?? fetch) : options.whatsapp;
  ctx.whatsapp = createWhatsAppBridge(ctx, channel, openWhatsAppStore(db));
  return ctx;
}
