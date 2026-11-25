import { useState } from 'react';
import { post, request } from './api';
import { RowButton } from './RowButton';
import { useAction } from './useAction';

export function AdminBinding() {
  const [done, setDone] = useState(false);
  const { run, busy, error } = useAction();
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const personal = hash.getAll('p');
  const admin = hash.getAll('a');
  const email = hash.get('cuenta');
  if (!email || personal.length !== 2 || admin.length !== 2 || ![...personal, ...admin].every((key) => /^[0-9a-f]{64}$/.test(key))) return null;
  const bind = () => void run(async () => {
    await request('/api/operator/bind', post({ personal, admin, email }));
    setDone(true);
  });
  return <section className="rd-card rd-glass">
    <h2>Vincular Claude Code y Codex</h2>
    <p>Cuenta {email}. Comprueba que tu instalador muestra el código <strong>{admin[0]!.slice(0, 8)}</strong>.</p>
    <p>Estos dos agentes podrán trabajar con tu cuenta personal y consultar el uso de Montu y el contexto compartido de tus equipos. Puedes revocar cada conexión en Tú → Tu agente.</p>
    {done ? <p role="status">Claude Code y Codex vinculados.</p> : <RowButton label="Autorizar mis dos agentes" disabled={busy} onClick={bind} />}
    {error && <p className="rd-note" role="alert">{error}</p>}
  </section>;
}
