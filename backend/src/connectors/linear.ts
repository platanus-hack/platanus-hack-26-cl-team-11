import { postLinearGraphql } from '../oauth/linear.js';
import { ConnectorError, type EventDraft, type OAuthConnector } from '../types.js';

const ASSIGNED_ISSUES_QUERY = `query RondaAssignedIssues($since: DateTimeOrDuration!) {
  viewer {
    assignedIssues(first: 50, filter: { updatedAt: { gte: $since } }, orderBy: updatedAt) {
      nodes { id identifier title url updatedAt createdAt dueDate priority state { name type } }
    }
  }
}`;

const ISSUE_CONTEXT_QUERY = `query RondaIssueContext($since: DateTimeOrDuration!) {
  viewer {
    assignedIssues(first: 50, filter: { updatedAt: { gte: $since } }, orderBy: updatedAt) {
      nodes {
        id
        project { id name progress startDate targetDate lead { email } }
        inverseRelations(first: 10) { nodes { type issue { identifier title state { type } assignee { email name } } } }
      }
    }
  }
  issues(first: 10, filter: { assignee: { null: true }, priority: { in: [1, 2] }, state: { type: { in: ["triage", "backlog", "unstarted"] } } }) {
    nodes { id identifier title url priority }
  }
}`;

const BLOCKS = 'blocks';
const CLOSED_STATE_TYPES = ['completed', 'canceled'];
const ACCESS_LOST_STATUS = 400;
const RATE_LIMITED_STATUS = 429;
export const UNOWNED_URGENT_TYPE = 'urgente_sin_dueno';

interface LinearProject {
  id: string;
  name: string;
  progress: number;
  startDate: string | null;
  targetDate: string | null;
  lead: { email: string } | null;
}

interface LinearRelation {
  type: string;
  issue: { identifier: string; title: string; state: { type: string } | null; assignee: { email: string; name: string } | null } | null;
}

interface LinearIssueContextNode {
  id: string;
  project?: LinearProject | null;
  inverseRelations?: { nodes: LinearRelation[] } | null;
}

interface LinearUnownedIssue {
  id: string;
  identifier: string;
  title: string;
  url: string;
  priority: number;
}

interface LinearIssueContext {
  viewer?: { assignedIssues?: { nodes?: LinearIssueContextNode[] } };
  issues?: { nodes?: LinearUnownedIssue[] };
}

export interface TaskProject {
  id: string;
  name: string;
  progress: number;
  startDate: string | null;
  targetDate: string | null;
  leadEmail: string | null;
}

export interface TaskBlocker {
  identifier: string;
  title: string;
  assigneeEmail: string | null;
  assigneeName: string | null;
}

interface TaskContext {
  project?: TaskProject;
  blockedBy?: TaskBlocker[];
}

const contextOf = (node: LinearIssueContextNode): TaskContext => {
  const blockedBy = (node.inverseRelations?.nodes ?? []).flatMap((relation): TaskBlocker[] => {
    const blocker = relation.issue;
    if (relation.type !== BLOCKS || !blocker || CLOSED_STATE_TYPES.includes(blocker.state?.type ?? '')) return [];
    return [{ identifier: blocker.identifier, title: blocker.title, assigneeEmail: blocker.assignee?.email?.toLowerCase() ?? null, assigneeName: blocker.assignee?.name ?? null }];
  });
  const project = node.project
    ? { id: node.project.id, name: node.project.name, progress: node.project.progress, startDate: node.project.startDate, targetDate: node.project.targetDate, leadEmail: node.project.lead?.email?.toLowerCase() ?? null }
    : undefined;
  return { ...(project ? { project } : {}), ...(blockedBy.length > 0 ? { blockedBy } : {}) };
};

const unownedDraft = (issue: LinearUnownedIssue, now: Date): EventDraft => ({
  source: 'linear',
  type: UNOWNED_URGENT_TYPE,
  externalId: `${issue.id}:sin-dueno:${now.toISOString().slice(0, 10)}`,
  occurredAt: now.toISOString(),
  summary: `${issue.identifier} ${issue.title} · urgente sin dueño`,
  raw: { identifier: issue.identifier, title: issue.title, url: issue.url, priority: issue.priority },
});

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

const toDraft = (issue: LinearIssue, context: TaskContext = {}): EventDraft => ({
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
    ...context,
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
    let context: LinearIssueContext = {};
    try {
      context = await postLinearGraphql<LinearIssueContext>(fetchImpl, accessToken, ISSUE_CONTEXT_QUERY, { since: since.toISOString() });
    } catch (failure) {
      if (!(failure instanceof ConnectorError) || failure.status === ACCESS_LOST_STATUS || failure.status === RATE_LIMITED_STATUS) throw failure;
      console.warn('Linear no entregó proyectos ni relaciones; se sigue solo con las tareas.', failure.message);
    }
    const contextById = new Map((context.viewer?.assignedIssues?.nodes ?? []).map((node) => [node.id, contextOf(node)]));
    const now = new Date();
    return [...viewer.assignedIssues.nodes.map((issue) => toDraft(issue, contextById.get(issue.id))), ...(context.issues?.nodes ?? []).map((issue) => unownedDraft(issue, now))];
  },
};
