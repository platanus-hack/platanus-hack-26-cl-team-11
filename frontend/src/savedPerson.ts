const STORAGE_KEY = 'ronda.persona';

export interface SavedPerson {
  token: string;
  name: string;
}

export function readSavedPerson(): SavedPerson | null {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (!parsed || typeof parsed !== 'object') return null;
    const { token, name } = parsed as Partial<SavedPerson>;
    return typeof token === 'string' && typeof name === 'string' ? { token, name } : null;
  } catch {
    return null;
  }
}

export function savePerson(person: SavedPerson): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(person));
  } catch {
    return;
  }
}
