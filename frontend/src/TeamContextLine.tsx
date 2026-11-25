import instructions from '../public/skills/montu-equipo/SYSTEM.md?raw';
import { useState } from 'react';
import { personPath, post, request } from './api';
import { CopyButton } from './CopyButton';
import { RowButton } from './RowButton';
import { useAction } from './useAction';

const SKILL = '/skills/montu-equipo/SKILL.md';


interface TeamSnapshot {
  consultado: string;
  equipos: Array<{ id: string; nombre: string; miRevision: number; traspasos: Array<{ mio: boolean; texto: string }> }>;
}

export function TeamContextLine({ token }: { token: string }) {
  const [snapshot, setSnapshot] = useState<TeamSnapshot | null>(null);
  const [teamId, setTeamId] = useState('');
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState('');
  const { busy, error, run } = useAction();
  const team = snapshot?.equipos.find((item) => item.id === teamId);
  const existing = team?.traspasos.find((note) => note.mio)?.texto ?? '';
  const load = () => request<TeamSnapshot>(personPath(token) + '/agent-context');
  const select = (data: TeamSnapshot, id: string) => {
    setSnapshot(data);
    setTeamId(id);
    setDraft(data.equipos.find((item) => item.id === id)?.traspasos.find((item) => item.mio)?.texto ?? '');
    setNotice('');
  };
  const refresh = () => void run(async () => {
    const data = await load();
    select(data, data.equipos.some((item) => item.id === teamId) ? teamId : (data.equipos.length === 1 ? data.equipos[0]!.id : ''));
  });
  const publish = () => void run(async () => {
    if (!team) return;
    const saved = await request<{ revision: number }>(personPath(token) + '/agent-handoff', post({ equipo: team.id, revision: team.miRevision, texto: draft }));
    const data = await load();
    const updated = data.equipos.find((item) => item.id === team.id);
    if (updated?.miRevision !== saved.revision || (updated.traspasos.find((item) => item.mio)?.texto ?? '') !== draft.trim()) {
      throw new Error('El resumen cambió. Actualiza el contexto para revisarlo.');
    }
    select(data, team.id);
    setNotice(draft.trim() ? 'Traspaso compartido con ' + team.nombre : 'Traspaso retirado');
  });

  return (
    <>
      <span className="rd-note">Agrega la skill a tu agente o copia la instrucción permanente en SYSTEM.md o en tu proyecto.</span>
      <div className="rd-actions"><a className="rd-button rd-button--quiet rd-button--small app-link" href={SKILL}>Skill de Montu para el equipo</a><CopyButton text={instructions} label="Copiar la instrucción permanente" /></div>
      <span className="rd-note">Para un chat sin conector, puedes llevar una copia fechada a tu conversación personal. Incluye tu bandeja privada.</span>
      <div className="rd-actions"><RowButton disabled={busy} onClick={refresh} label={snapshot ? 'Actualizar contexto' : 'Ver contexto para pegar'} /></div>
      {snapshot && (
        <>
          <details><summary>Contexto del {new Date(snapshot.consultado).toLocaleString('es-CL')}</summary><pre className="rd-code">{JSON.stringify(snapshot, null, 2)}</pre></details>
          <div className="rd-actions"><CopyButton text={JSON.stringify(snapshot, null, 2)} label="Copiar mi contexto para mi chat personal" /></div>
          {snapshot.equipos.length > 0 ? (
            <>
              <label>Equipo del traspaso <select className="rd-input" value={teamId} onChange={(event) => select(snapshot, event.target.value)}>
                {!team && <option value="">Elige un equipo</option>}
                {snapshot.equipos.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
              </select></label>
              <label>Resumen visible para {team?.nombre ?? 'el equipo elegido'}<textarea className="rd-input" disabled={!team} rows={3} maxLength={2000} value={draft} onChange={(event) => { setDraft(event.target.value); setNotice(''); }} /></label>
              <div className="rd-actions"><RowButton label={draft.trim() ? 'Publicar traspaso' : 'Retirar traspaso'} disabled={busy || !team || draft.trim() === existing} onClick={publish} /></div>
            </>
          ) : <span className="rd-note">Únete a tu equipo privado en la pestaña Equipo para compartir un traspaso.</span>}
        </>
      )}
      {notice && <span className="rd-note" role="status">{notice}</span>}
      {error && <span className="rd-note" role="alert">{error}</span>}
    </>
  );
}
