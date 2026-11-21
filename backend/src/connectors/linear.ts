import { postLinearGraphql } from '../oauth/linear.js';
import type { EventDraft, OAuthConnector } from '../types.js';

const ASSIGNED_ISSUES_QUERY = `query RondaAssignedIssues($since: DateTimeOrDuration!) {
  viewer {
    assignedIssues(first: 50, filter: { updatedAt: { gte: $since } }, orderBy: updatedAt) {
      nodes { id identifier title url updatedAt createdAt dueDate priority state { name type } }
    }
  }
}`;

interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  url: string;
  updatedAt: string;
  createdAt: string;
  dueDate: string | null;
  priority: number;
  state: { name: string; type: string };
}

interface LinearAssignedIssues {
  viewer: { assignedIssues: { nodes: LinearIssue[] } };
}

const toDraft = (issue: LinearIssue): EventDraft => ({
  source: 'linear',
  type: 'tarea',
  externalId: `${issue.id}:${issue.updatedAt}`,
  occurredAt: issue.updatedAt,
  summary: `${issue.identifier} ${issue.title} · ${issue.state.name}`,
  raw: {
    identifier: issue.identifier,
    title: issue.title,
    url: issue.url,
    state: issue.state.name,
    stateType: issue.state.type,
    priority: issue.priority,
    dueDate: issue.dueDate,
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
  },
});

export const linear: OAuthConnector = {
  id: 'linear',
  label: 'Linear',
  how: 'Cuenta de Linear',
  kind: 'oauth',
  provider: 'linear',
  scopes: ['read'],

  async pull(accessToken, _account, since, fetchImpl) {
    const { viewer } = await postLinearGraphql<LinearAssignedIssues>(fetchImpl, accessToken, ASSIGNED_ISSUES_QUERY, { since: since.toISOString() });
    return viewer.assignedIssues.nodes.map(toDraft);
  },
};
