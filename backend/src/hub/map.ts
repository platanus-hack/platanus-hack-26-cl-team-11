import { HUB_SOURCES, TOPICS, findHubSource, type MockItem } from './catalog.js';
import type { HubItem, HubItemDraft, HubStore } from './store.js';

const ITEMS_PER_SOURCE = 6;
const LINK_ITEMS = 40;
const SEED_ITEMS = 3;
const SEED_SPACING_MS = 5 * 60 * 60 * 1000;

export interface MapSource {
  id: string;
  label: string;
  category: string;
  how: string;
  connected: boolean;
  account: string | null;
  connectedAt: string | null;
  lastUpdate: string | null;
  total: number;
  items: HubItem[];
}

export interface MapLink {
  a: string;
  b: string;
  topics: Array<{ id: string; label: string }>;
}

export interface ContextMap {
  name: string;
  mock: true;
  topics: Record<string, string>;
  sources: MapSource[];
  links: MapLink[];
}

export function buildMap(hub: HubStore, personToken: string, name: string): ContextMap {
  const connections = new Map(hub.connections(personToken).map((connection) => [connection.source, connection]));
  const totals = hub.countBySource(personToken);
  const topicsBySource = new Map<string, Set<string>>();

  const sources = HUB_SOURCES.filter((source) => !source.onlyWhenConnected || connections.has(source.id)).map((source): MapSource => {
    const connection = connections.get(source.id);
    const items = connection ? hub.items(personToken, source.id, ITEMS_PER_SOURCE) : [];
    if (connection) topicsBySource.set(source.id, new Set(hub.items(personToken, source.id, LINK_ITEMS).flatMap((item) => item.topics)));
    return {
      id: source.id,
      label: source.label,
      category: source.category,
      how: source.how,
      connected: Boolean(connection),
      account: connection?.account ?? null,
      connectedAt: connection?.connectedAt ?? null,
      lastUpdate: items[0]?.occurredAt ?? null,
      total: totals[source.id] ?? 0,
      items,
    };
  });

  const connected = sources.filter((source) => source.connected);
  const links: MapLink[] = [];
  connected.forEach((first, index) => {
    for (const second of connected.slice(index + 1)) {
      const mine = topicsBySource.get(first.id) ?? new Set<string>();
      const shared = [...(topicsBySource.get(second.id) ?? [])].filter((topic) => mine.has(topic));
      if (shared.length) links.push({ a: first.id, b: second.id, topics: shared.map((id) => ({ id, label: TOPICS[id] ?? id })) });
    }
  });

  return { name, mock: true, topics: TOPICS, sources, links };
}

const toDraft = (source: string, item: MockItem, occurredAt: Date): HubItemDraft => ({ source, summary: item.summary, topics: item.topics, occurredAt: occurredAt.toISOString() });

export function connectMock(hub: HubStore, personToken: string, personName: string, sourceId: string, now: Date) {
  const source = findHubSource(sourceId);
  if (!source) return null;
  const already = hub.connections(personToken).some((connection) => connection.source === sourceId);
  const connection = hub.connect(personToken, sourceId, source.account(personName));
  if (!already) {
    source.pool.slice(0, SEED_ITEMS).forEach((item, index) => {
      hub.addItem(personToken, toDraft(sourceId, item, new Date(now.getTime() - (SEED_ITEMS - index) * SEED_SPACING_MS)));
    });
  }
  return connection;
}

export function simulatePush(hub: HubStore, personToken: string, now: Date): HubItem | null {
  const connected = hub.connections(personToken);
  if (!connected.length) return null;
  const totals = hub.countBySource(personToken);
  const grandTotal = Object.values(totals).reduce((sum, value) => sum + value, 0);
  const pick = connected[grandTotal % connected.length];
  const source = pick && findHubSource(pick.source);
  if (!source) return null;
  const item = source.pool[(totals[source.id] ?? 0) % source.pool.length];
  return item ? hub.addItem(personToken, toDraft(source.id, item, now)) : null;
}
