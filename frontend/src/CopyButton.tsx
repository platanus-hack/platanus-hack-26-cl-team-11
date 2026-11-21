import { useEffect, useState } from 'react';

const FEEDBACK_MS = 2000;

type CopyState = 'idle' | 'copied' | 'failed';

const LABEL: Record<CopyState, string> = {
  idle: 'Copiar',
  copied: 'Copiado',
  failed: 'No se pudo',
};

export function CopyButton({ text, label, menu = false }: { text: string; label: string; menu?: boolean }) {
  const [state, setState] = useState<CopyState>('idle');

  useEffect(() => {
    if (state === 'idle') return;
    const timer = window.setTimeout(() => setState('idle'), FEEDBACK_MS);
    return () => window.clearTimeout(timer);
  }, [state]);

  function copy() {
    const clipboard: Clipboard | undefined = navigator.clipboard;
    if (!clipboard) return setState('failed');
    void clipboard.writeText(text).then(
      () => setState('copied'),
      () => setState('failed'),
    );
  }

  return (
    <button className={menu ? 'rd-menu__item' : 'rd-button rd-button--quiet rd-button--small'} type="button" aria-label={state === 'idle' ? label : undefined} onClick={copy}>
      <span aria-live="polite">{menu && state === 'idle' ? label : LABEL[state]}</span>
    </button>
  );
}
