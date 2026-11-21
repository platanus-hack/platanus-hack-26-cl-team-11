import type { EventDraft, KeyConnector } from '../types.js';
import { getJson } from './http.js';

const BASE = 'https://api.github.com';

interface GithubEvent {
  id: string;
  type: string;
  created_at: string;
  repo: { name: string };
  payload: {
    size?: number;
    commits?: unknown[];
    action?: string;
    pull_request?: { title?: string; html_url?: string; merged?: boolean };
  };
}

const headers = (secret: string) => ({
  authorization: `Bearer ${secret}`,
  accept: 'application/vnd.github+json',
  'user-agent': 'ronda-hack',
});

function toDraft(event: GithubEvent): EventDraft | null {
  if (event.type === 'PushEvent') {
    const commits = event.payload.size ?? event.payload.commits?.length ?? 0;
    return {
      source: 'github',
      type: 'commit',
      externalId: event.id,
      occurredAt: event.created_at,
      summary: `${commits} ${commits === 1 ? 'commit' : 'commits'} en ${event.repo.name}`,
      raw: { repo: event.repo.name, commits },
    };
  }
  if (event.type === 'PullRequestEvent' && event.payload.pull_request) {
    const pull = event.payload.pull_request;
    const action = event.payload.action === 'closed' ? (pull.merged ? 'PR mergeado' : 'PR cerrado') : event.payload.action === 'opened' ? 'PR abierto' : null;
    if (!action) return null;
    return {
      source: 'github',
      type: 'pull_request',
      externalId: event.id,
      occurredAt: event.created_at,
      summary: `${action} en ${event.repo.name}${pull.title ? `: ${pull.title}` : ''}`,
      raw: { repo: event.repo.name, action: event.payload.action, title: pull.title ?? null, url: pull.html_url ?? null },
    };
  }
  return null;
}

export const github: KeyConnector = {
  id: 'github',
  label: 'GitHub',
  how: 'Token personal',
  kind: 'key',
  async identify(secret, fetchImpl) {
    const user = await getJson<{ login: string }>(fetchImpl, `${BASE}/user`, headers(secret), 'GitHub');
    return user.login;
  },

  async pull(secret, account, since, fetchImpl) {
    const events = await getJson<GithubEvent[]>(fetchImpl, `${BASE}/users/${encodeURIComponent(account)}/events?per_page=100`, headers(secret), 'GitHub');
    return events
      .filter((event) => new Date(event.created_at) >= since)
      .map(toDraft)
      .filter((draft): draft is EventDraft => draft !== null);
  },
};
