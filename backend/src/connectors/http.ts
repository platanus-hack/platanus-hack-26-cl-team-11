import { ConnectorError, type Fetch } from '../types.js';

export async function getJson<T>(fetchImpl: Fetch, url: string, headers: Record<string, string>, service: string): Promise<T> {
  let response: Response;
  try {
    response = await fetchImpl(url, { headers });
  } catch {
    throw new ConnectorError(`No se pudo contactar a ${service}.`);
  }
  if (response.status === 401 || response.status === 403) throw new ConnectorError(`${service} rechazó la llave.`, 400);
  if (response.status === 429) throw new ConnectorError(`${service} pidió esperar antes de reintentar.`, 429);
  if (!response.ok) throw new ConnectorError(`${service} respondió ${response.status}.`);
  return (await response.json()) as T;
}
