import { useCallback, useEffect, useState } from 'react';
import { messageOf } from './format';

const REFRESH_MS = 5000;

export function usePolling(load: () => Promise<void>, everyMs: number = REFRESH_MS) {
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    () =>
      load()
        .then(() => setError(null))
        .catch((failure: unknown) => setError(messageOf(failure, 'No se pudo cargar.'))),
    [load],
  );

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), everyMs);
    return () => window.clearInterval(timer);
  }, [refresh, everyMs]);

  return { error, refresh };
}
