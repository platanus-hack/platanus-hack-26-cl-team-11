import { useCallback, useEffect, useState } from 'react';
import { messageOf } from './format';
import { SignInRequired } from './api';

const REFRESH_MS = 5000;

export function usePolling(load: () => Promise<void>, everyMs: number = REFRESH_MS) {
  const [error, setError] = useState<string | null>(null);
  const [signInRequired, setSignInRequired] = useState(false);

  const refresh = useCallback(
    () =>
      load()
        .then(() => {
          setError(null);
          setSignInRequired(false);
        })
        .catch((failure: unknown) => {
          setError(messageOf(failure, 'No se pudo cargar.'));
          setSignInRequired(failure instanceof SignInRequired);
        }),
    [load],
  );

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), everyMs);
    return () => window.clearInterval(timer);
  }, [refresh, everyMs]);

  return { error, refresh, signInRequired };
}
