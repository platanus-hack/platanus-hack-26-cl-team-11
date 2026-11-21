import { getGithubJson } from '../oauth/github.js';
import type { EventDraft, OAuthConnector } from '../types.js';

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

export const github: OAuthConnector = {
  id: 'github',
  label: 'GitHub',
  how: 'Cuenta de GitHub',
  kind: 'oauth',
  provider: 'github',
  scopes: ['read:user'],

  async pull(accessToken, account, since, fetchImpl) {
    const events = await getGithubJson<GithubEvent[]>(fetchImpl, `/users/${encodeURIComponent(account)}/events?per_page=100`, accessToken);
    return events
      .filter((event) => new Date(event.created_at) >= since)
      .map(toDraft)
      .filter((draft): draft is EventDraft => draft !== null);
  },
};
