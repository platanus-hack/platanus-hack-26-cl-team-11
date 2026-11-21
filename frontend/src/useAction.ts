import { useState } from 'react';
import { messageOf } from './format';

export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (failure) {
      setError(messageOf(failure, 'No se pudo completar.'));
    } finally {
      setBusy(false);
    }
  }

  return { busy, error, run };
}
