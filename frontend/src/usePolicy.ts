import { useEffect, useState } from 'react';
import { fetchPolicy, updatePolicy, type Policy } from './api';
import { messageOf } from './format';
import { useAction } from './useAction';

export function usePolicy(token: string) {
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { busy, error, run } = useAction();

  useEffect(() => {
    let current = true;
    fetchPolicy(token)
      .then((loaded) => {
        if (!current) return;
        setPolicy(loaded);
        setLoadError(null);
      })
      .catch((failure: unknown) => {
        if (current) setLoadError(messageOf(failure, 'No se pudieron cargar tus permisos.'));
      });
    return () => {
      current = false;
    };
  }, [token]);

  const change = (changes: Partial<Policy>) => run(async () => setPolicy(await updatePolicy(token, changes)));

  return { policy, busy, problem: error ?? loadError, change };
}
