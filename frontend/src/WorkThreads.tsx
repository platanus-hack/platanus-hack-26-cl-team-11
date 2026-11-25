import { useEffect, useState } from 'react';
import { request, post, SignInRequired } from './api';
import { CopyButton } from './CopyButton';
import { Face } from './Face';
import { SectionHead } from './SectionHead';
import { Item } from './Item';

type Entry = {
  id: number;
  titulo: string;
  referencia: string;
  tipo: string;
  texto: string;
  persona: string;
  agente: string;
  enlace: string;
  fecha: string;
};
type Result = { titulo?: string; referencia?: string; mensajes?: Entry[]; hilos?: Entry[]; antes: number | null };
const kinds: Record<string, string> = { hallazgo: 'Hallazgo', pregunta: 'Pregunta', decision: 'Decisión', cierre: 'Cierre' };
function Evidence({ text }: { text: string }) {
  return (
    <>
      {text.split(/(https?:\/\/[^\s<>"\x60]+)/g).map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer">
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </>
  );
}
export function WorkThreads({ team, topic }: { team: string; topic?: string }) {
  const params = new URLSearchParams(location.search);
  const base = '/equipo/' + encodeURIComponent(team) + '/hilos';
  const [data, setData] = useState<Result>();
  const [error, setError] = useState('');
  const [joining,setJoining]=useState(false);
  const [pending,setPending]=useState(false);
  async function join() {
    setJoining(true);
    try { await request('/api/team-threads/'+encodeURIComponent(team)+'/join',post({}));setPending(true); } catch(e) {setError(e instanceof Error?e.message:'No se pudo solicitar acceso.');} finally {setJoining(false);}
  }
  const [login, setLogin] = useState(false);
  useEffect(() => {
    let active = true;
    const query = new URLSearchParams(location.search);
    const anchor = /^#mensaje-(\d+)$/.exec(location.hash);
    if (topic && anchor && !query.has('antes')) query.set('antes', String(Number(anchor[1]) + 1));
    request<Result>(
      '/api/team-threads/' + encodeURIComponent(team) + (topic ? '/' + encodeURIComponent(topic) : '') + '?' + query,
    ).then(
      (value) => {
        if (active) setData(value);
      },
      (e) => {
        if (active) {
          setError(e.message);
          setLogin(e instanceof SignInRequired);
        }
      },
    );
    return () => {
      active = false;
    };
  }, [team, topic]);
  useEffect(() => {
    if (data?.mensajes) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }, [data]);
  const older = new URLSearchParams(params);
  if (data?.antes) older.set('antes', String(data.antes));
  return (
    <div className="app-block">
      {topic && <a href={base}>‹ Hilos del equipo</a>}
      <SectionHead first title={data?.titulo ?? 'Hilos del equipo'} />
      {login ? (
        <a
          className="rd-button app-link"
          href={'/api/login/google/start?volver=' + encodeURIComponent(location.pathname + location.search + location.hash)}
        >
          Entrar con Google
        </a>
      ) : error ? (
        <><p role="alert" className="rd-note">{pending?'Solicitud enviada. Cuando el equipo la apruebe, vuelve a abrir este enlace.':error}</p>
          {!pending && error==='Este hilo requiere pertenecer al equipo privado.' && <button className="rd-button" disabled={joining} onClick={()=>void join()}>Solicitar acceso al equipo</button>}</>
      ) : !data ? (
        <p role="status">Cargando…</p>
      ) : (
        <>
          {data.hilos && (
            <>
              <form action={base} className="rd-actions">
                <input
                  className="rd-input"
                  type="search"
                  name="buscar"
                  defaultValue={params.get('buscar') ?? ''}
                  placeholder="Ticket, PR, tema o persona"
                  aria-label="Buscar hilos"
                />
                <button className="rd-button" type="submit">
                  Buscar
                </button>
              </form>
              <div className="rd-list">
                {data.hilos.map((r) => (
                  <Item
                    key={r.id}
                    title={r.titulo}
                    icon={<Face name={r.persona} />}
                    subtitle={r.referencia + ' · ' + r.persona}
                    href={r.enlace}
                  />
                ))}
              </div>
              {!data.hilos.length && (
                <p className="rd-note">
                  {params.has('buscar') ? 'Sin resultados.' : 'El primer avance que comparta un agente aparecerá aquí.'}
                </p>
              )}
            </>
          )}
          {data.mensajes && (
            <>
              <p className="rd-note">{data.referencia}</p>
              {data.mensajes.map((r) => (
                <article key={r.id} className="rd-card rd-glass" id={'mensaje-' + r.id}>
                  <div className="rd-actions">
                    <Face name={r.persona} />
                    <strong>
                      {r.agente} de {r.persona}
                    </strong>
                  </div>
                  <p className="rd-note">
                    {kinds[r.tipo]} · <a href={r.enlace + '?antes=' + (r.id + 1) + '#mensaje-' + r.id}>{new Date(r.fecha).toLocaleString('es-CL')}</a>
                  </p>
                  <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                    <Evidence text={r.texto} />
                  </p>
                </article>
              ))}
              {(params.has('antes') || location.hash.startsWith('#mensaje-')) && <a href={location.pathname}>Ver lo más reciente</a>}
              <CopyButton label="Copiar enlace al hilo" text={location.origin + location.pathname} />
            </>
          )}
          {Boolean(data.antes) && <a href={location.pathname + '?' + older}>Ver anteriores</a>}
        </>
      )}
    </div>
  );
}
