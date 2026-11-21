import { useCallback, useEffect, useState } from 'react';
import { messageOf } from './format';

const REFRESH_MS = 5000;

export function usePolling(load: () => Promise<void>) {
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
    const timer = window.setInterval(() => void refresh(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  return { error, refresh };
}
