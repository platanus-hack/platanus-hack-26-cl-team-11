import { ConnectorError, type EventDraft, type Fetch, type KeyConnector } from '../types.js';

const ENDPOINT = 'https://api.linear.app/graphql';
const AUTHENTICATION_ERROR_CODE = 'AUTHENTICATION_ERROR';
const RATE_LIMIT_ERROR_CODE = 'RATELIMITED';

const VIEWER_QUERY = 'query RondaViewer { viewer { id name email } }';

const ASSIGNED_ISSUES_QUERY = `query RondaAssignedIssues($since: DateTimeOrDuration!) {
  viewer {
    assignedIssues(first: 50, filter: { updatedAt: { gte: $since } }, orderBy: updatedAt) {
      nodes { id identifier title url updatedAt createdAt dueDate priority state { name type } }
    }
  }
}`;

interface GraphqlError {
  message?: string;
  extensions?: { code?: string; type?: string };
}

interface GraphqlBody<T> {
  data?: T | null;
  errors?: GraphqlError[];
}

interface LinearViewer {
  viewer: { id: string; name: string; email: string };
}

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

const AUTHENTICATION_ERROR_TYPE = 'authentication error';

const hasErrorCode = (errors: GraphqlError[], code: string) => errors.some((error) => error.extensions?.code === code);
const isAuthenticationFailure = (errors: GraphqlError[]) =>
  hasErrorCode(errors, AUTHENTICATION_ERROR_CODE) || errors.some((error) => error.extensions?.type === AUTHENTICATION_ERROR_TYPE);

async function readBody<T>(response: Response): Promise<GraphqlBody<T>> {
  try {
    return (await response.json()) as GraphqlBody<T>;
  } catch {
    return {};
  }
}

async function postGraphql<T>(fetchImpl: Fetch, secret: string, query: string, variables: Record<string, unknown> = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetchImpl(ENDPOINT, {
      method: 'POST',
      headers: { authorization: secret, 'content-type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
  } catch {
    throw new ConnectorError('No se pudo contactar a Linear.');
  }
  const body = await readBody<T>(response);
  const errors = body.errors ?? [];
  if (response.status === 401 || response.status === 403 || isAuthenticationFailure(errors)) throw new ConnectorError('Linear rechazó la llave.', 400);
  if (response.status === 429 || hasErrorCode(errors, RATE_LIMIT_ERROR_CODE)) throw new ConnectorError('Linear pidió esperar antes de reintentar.', 429);
  if (!response.ok) throw new ConnectorError(`Linear respondió ${response.status}.`);
  if (errors.length > 0) throw new ConnectorError(`Linear rechazó la consulta: ${errors[0]?.message ?? 'sin detalle'}.`);
  if (!body.data) throw new ConnectorError('Linear respondió sin datos.');
  return body.data;
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

export const linear: KeyConnector = {
  id: 'linear',
  label: 'Linear',
  how: 'Llave personal',
  kind: 'key',
  async identify(secret, fetchImpl) {
    const { viewer } = await postGraphql<LinearViewer>(fetchImpl, secret, VIEWER_QUERY);
    return viewer.email;
  },

  async pull(secret, _account, since, fetchImpl) {
    const { viewer } = await postGraphql<LinearAssignedIssues>(fetchImpl, secret, ASSIGNED_ISSUES_QUERY, { since: since.toISOString() });
    return viewer.assignedIssues.nodes.map(toDraft);
  },
};
