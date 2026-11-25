import { useEffect, useState, type ReactNode } from 'react';
import { request, SignInRequired } from './api';
import { AdminBinding } from './AdminBinding';
import { AssistantLogo } from './AssistantLogo';
import { CopyButton } from './CopyButton';
import { Face } from './Face';
import { Glyph } from './Glyph';
import { Item } from './Item';
import { ItemIcon } from './ItemIcon';
import { SectionHead } from './SectionHead';
import { SourceLogo } from './SourceLogo';
import type { AssistantKind } from './roomApi';
import './adminDirectory.css';

type Agent = { id: string; tipo: AssistantKind; nombre: string; creado: string; ultimaConexion: string | null; admin: boolean };
type Source = { id: string; nombre: string; estado: string; desde: string | null; ultimaCarga: string | null; registros: number };
type Usage = {
  persona: string;
  nombre: string;
  lecturas: number;
  cambiosTraspaso: number;
  commitsHistoricos: number;
  ultimaActividadContexto: string | null;
  agentes: Agent[];
  fuentes: Source[];
};
type Directory = { yo: string; personas: Usage[]; equipos: { id: string; nombre: string; miembros: string[] }[] };
type Profile = {
  nombre: string;
  propia: boolean;
  visible: boolean;
  agentes: Agent[];
  fuentes: Source[];
  contexto: { trabajo: string[]; temas: string[]; agenda: string[] } | null;
  archivos: { id: string; ruta: string; actualizado: string; permiso: string; autor: string }[];
  traspasos: { id: string; agenteId: string; agente: string; equipo: string; texto: string; actualizado: string }[];
};
type FileBody = { texto: string };
const route = (params: Record<string, string> = {}) => '/admin' + (Object.keys(params).length ? '?' + new URLSearchParams(params) : '');
const personUrl = (persona: string, vista = 'contexto', item?: string) => route({ persona, vista, ...(item ? { item } : {}) });
const date = (value: string | null) =>
  value
    ? new Date(value).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Santiago' })
    : 'Sin registro';
const base = '/api/operator/directory';
const labels: Record<string, string> = {
  personas: 'Personas',
  contextos: 'Contextos',
  agentes: 'Agentes',
  conectores: 'Conectores',
  contexto: 'Contexto',
  uso: 'Uso',
};

function useRead<T>(url: string) {
  const [state, setState] = useState<{ url: string; data?: T; error?: string; login?: boolean }>();
  useEffect(() => {
    let active = true;
    request<T>(url).then(
      (data) => active && setState({ url, data }),
      (err: Error) => active && setState({ url, error: err.message, login: err instanceof SignInRequired }),
    );
    return () => {
      active = false;
    };
  }, [url]);
  return state?.url === url ? state : undefined;
}
function Feedback({ error, login }: { error?: string; login?: boolean }) {
  if (login)
    return (
      <a
        className="rd-button app-link"
        href={'/api/login/google/start?volver=' + encodeURIComponent('/admin' + location.search + location.hash)}
      >
        Entrar con Google para ver el directorio
      </a>
    );
  return (
    <p className="rd-note" role={error ? 'alert' : 'status'}>
      {error || 'Cargando…'}
    </p>
  );
}
function Tabs({ tabs, selected, link }: { tabs: string[]; selected: string; link: (tab: string) => string }) {
  return (
    <nav className="admin-tabs" aria-label={tabs.includes('personas') ? 'Directorio' : 'Ficha de persona'}>
      {tabs.map((t) => (
        <a key={t} aria-current={selected === t ? 'page' : undefined} href={link(t)}>
          {labels[t]}
        </a>
      ))}
    </nav>
  );
}
const icon = (name: 'file' | 'chat' | 'link') => (
  <ItemIcon>
    <Glyph name={name} />
  </ItemIcon>
);
function Back({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className="admin-back" href={href}>
      ‹ {children}
    </a>
  );
}
function Empty({ children }: { children: ReactNode }) {
  return <p className="rd-note">{children}</p>;
}
function FileText({ persona, id }: { persona: string; id: string }) {
  const file = useRead<FileBody>(base + '/person/' + encodeURIComponent(persona) + '?archivo=' + encodeURIComponent(id));
  return file?.data ? <pre className="admin-text">{file.data.texto}</pre> : <Feedback {...file} />;
}
function ProfileView({ id, tab, item, stats }: { id: string; tab: string; item: string | null; stats: Usage }) {
  const state = useRead<Profile>(base + '/person/' + encodeURIComponent(id));
  if (!state?.data) return <Feedback {...state} />;
  const p = state.data;
  const link = (view: string, resource?: string) => personUrl(id, view, resource);
  const file = p.archivos.find((v) => 'f-' + v.id === item);
  const handoff = p.traspasos.find((v) => 't-' + v.id === item);
  const agent = p.agentes.find((v) => v.id === item);
  const source = p.fuentes.find((v) => v.id === item);
  const mcp = p.agentes.find((v) => 'mcp-' + v.id === item);
  const transferRow = (h: Profile['traspasos'][number]) => (
    <Item
      key={h.id}
      icon={icon('chat')}
      title={h.agente}
      subtitle={h.equipo + ' · ' + date(h.actualizado)}
      href={link('contexto', 't-' + h.id)}
    />
  );
  let content: ReactNode;
  if (tab === 'contexto' && !item) {
    content = p.visible ? (
      <>
        {p.contexto && [...p.contexto.trabajo, ...p.contexto.temas, ...p.contexto.agenda].length > 0 && (
          <section className="rd-card rd-glass">
            <h2>Trabajo y agenda</h2>
            {[...p.contexto.trabajo, ...p.contexto.temas, ...p.contexto.agenda].map((s, i) => (
              <p key={i}>{s}</p>
            ))}
          </section>
        )}
        <section className="rd-card rd-glass">
          <h2>Archivos de contexto</h2>
          {p.archivos.map((f) => (
            <Item
              key={f.id}
              icon={icon('file')}
              title={f.ruta}
              subtitle={
                date(f.actualizado) +
                ' · ' +
                ({ siempre: 'Compartido', nunca: 'Privado', preguntar: 'Pedir permiso' }[f.permiso] ?? f.permiso)
              }
              href={link('contexto', 'f-' + f.id)}
            />
          ))}
          {!p.archivos.length && <Empty>Sin archivos disponibles.</Empty>}
        </section>
        <section className="rd-card rd-glass">
          <h2>Traspasos</h2>
          {p.traspasos.map(transferRow)}
          {!p.traspasos.length && <Empty>Sin traspasos vigentes.</Empty>}
        </section>
      </>
    ) : (
      <Empty>El contexto se comparte con integrantes del mismo equipo privado.</Empty>
    );
  } else if (tab === 'contexto' && file)
    content = (
      <section className="rd-card rd-glass">
        <h2>{file.ruta}</h2>
        <p className="rd-note">
          {file.autor} · {date(file.actualizado)}
        </p>
        <FileText persona={id} id={file.id} />
      </section>
    );
  else if (tab === 'contexto' && handoff)
    content = (
      <section className="rd-card rd-glass">
        <h2>Traspaso de {handoff.agente}</h2>
        <p className="rd-note">
          {handoff.equipo} · {date(handoff.actualizado)}
        </p>
        <p className="admin-text">{handoff.texto}</p>
      </section>
    );
  else if (tab === 'agentes' && !item)
    content = (
      <section className="rd-card rd-glass">
        <h2>Agentes de {p.nombre}</h2>
        {p.agentes.map((a) => (
          <Item
            key={a.id}
            icon={<AssistantLogo kind={a.tipo} />}
            title={a.nombre}
            subtitle={'Última conexión o alta · ' + date(a.ultimaConexion)}
            href={link('agentes', a.id)}
          />
        ))}
        {!p.agentes.length && <Empty>Sin agentes registrados.</Empty>}
      </section>
    );
  else if (tab === 'agentes' && agent)
    content = (
      <section className="rd-card rd-glass">
        <h2>{agent.nombre}</h2>
        <p>Alta · {date(agent.creado)}</p>
        <p>Última conexión o alta · {date(agent.ultimaConexion)}</p>
        <Item icon={icon('file')} title={'Contexto de ' + p.nombre} href={link('contexto')} />
        <Item icon={icon('link')} title="Ver conexión de Montu" href={link('conectores', 'mcp-' + agent.id)} />
        {p.traspasos.filter((h) => h.agenteId === agent.id).map(transferRow)}
      </section>
    );
  else if (tab === 'conectores' && !item)
    content = (
      <section className="rd-card rd-glass">
        <h2>Conexiones de agentes</h2>
        {p.agentes.map((a) => (
          <Item
            key={a.id}
            icon={<AssistantLogo kind={a.tipo} />}
            title={a.nombre}
            subtitle={a.admin ? 'Personal y Montu Admin' : 'Personal'}
            href={link('conectores', 'mcp-' + a.id)}
          />
        ))}
        {!p.agentes.length && <Empty>Sin conexiones de agentes.</Empty>}
        {p.visible && (
          <>
            <h2>Fuentes de la persona</h2>
            {p.fuentes.map((s) => (
              <Item key={s.id} icon={<SourceLogo id={s.id} />} title={s.nombre} subtitle={s.estado} href={link('conectores', s.id)} />
            ))}
          </>
        )}
      </section>
    );
  else if (tab === 'conectores' && mcp)
    content = (
      <section className="rd-card rd-glass">
        <h2>Montu · {mcp.nombre}</h2>
        <p>{mcp.admin ? 'Acceso personal y administración de solo lectura.' : 'Registro personal de Montu.'}</p>
        <p>Última conexión o alta · {date(mcp.ultimaConexion)}</p>
        <Item icon={<AssistantLogo kind={mcp.tipo} />} title="Ver agente" href={link('agentes', mcp.id)} />
      </section>
    );
  else if (tab === 'conectores' && source)
    content = (
      <section className="rd-card rd-glass">
        <h2>{source.nombre}</h2>
        <p>{source.estado}</p>
        <p>Desde · {date(source.desde)}</p>
        <p>Última carga · {date(source.ultimaCarga)}</p>
        <p>{source.registros} registros</p>
      </section>
    );
  else if (tab === 'uso' && !item)
    content = (
      <section className="rd-card rd-glass">
        <h2>Actividad de los últimos 30 días</h2>
        <p>
          {stats.lecturas} lecturas de contexto · {stats.cambiosTraspaso} cambios de traspaso
        </p>
        <p>Última actividad · {date(stats.ultimaActividadContexto)}</p>
        <p>{stats.commitsHistoricos} cambios históricos en el repo</p>
      </section>
    );
  else content = <Empty>Este elemento ya no está disponible.</Empty>;
  return (
    <>
      <Back href="/admin">Directorio</Back>
      <div className="admin-name">
        <Face name={p.nombre} />
        <SectionHead title={p.nombre} first />
      </div>
      <Tabs tabs={['contexto', 'agentes', 'conectores', 'uso']} selected={tab} link={link} />
      {item && <Back href={link(tab)}>{labels[tab]}</Back>}
      {content}
    </>
  );
}

export function AdminDirectory() {
  const [query, setQuery] = useState(location.search);
  const params = new URLSearchParams(query);
  const id = params.get('persona');
  const team = params.get('equipo');
  const tab = params.get('vista') ?? (id ? 'contexto' : 'personas');
  const search = params.get('buscar') ?? '';
  const data = useRead<Directory>(base + '/index');
  const [filter, setFilter] = useState(search);
  useEffect(() => {
    const pop = () => {
      setQuery(location.search);
      setFilter(new URLSearchParams(location.search).get('buscar') ?? '');
    };
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, []);
  if (!data?.data) return <Feedback {...data} />;
  const directory = data.data;
  const profile = directory.personas.find((p) => p.persona === id);
  const chosen = directory.equipos.find((t) => t.id === team);
  const listUrl = (vista: string, equipo = team) => route({ vista, ...(equipo ? { equipo } : {}), ...(search ? { buscar: search } : {}) });
  const matches = (...v: string[]) => v.join(' ').toLocaleLowerCase('es').includes(filter.trim().toLocaleLowerCase('es'));
  const people = directory.personas
    .filter((p) => !team || chosen?.miembros.includes(p.persona))
    .sort((a, b) => Number(b.persona === directory.yo) - Number(a.persona === directory.yo) || a.nombre.localeCompare(b.nombre, 'es'));
  const rows: ReactNode[] = [];
  for (const p of people) {
    const dest = (view: string, resource?: string) => personUrl(p.persona, view, resource);
    if (tab === 'contextos' && matches(p.nombre)) {
      const groups = directory.equipos.filter((t) => t.miembros.includes(p.persona));
      if (directory.yo === p.persona || groups.length)
        rows.push(
          <Item
            key={p.persona}
            icon={<Face name={p.nombre} />}
            title={p.nombre}
            subtitle={groups.map((t) => t.nombre).join(' · ') || 'Mi contexto'}
            href={dest('contexto')}
          />,
        );
    }
    if (tab === 'personas' && matches(p.nombre))
      rows.push(
        <Item
          key={p.persona}
          icon={<Face name={p.nombre} />}
          title={p.nombre}
          subtitle={p.agentes.length + ' agentes · ' + p.lecturas + ' lecturas'}
          href={dest('contexto')}
        />,
      );
    if (tab === 'agentes' || tab === 'conectores')
      for (const a of p.agentes) {
        if (matches(p.nombre, a.nombre))
          rows.push(
            <Item
              key={p.persona + a.id}
              icon={<AssistantLogo kind={a.tipo} />}
              title={a.nombre}
              subtitle={p.nombre + (tab === 'conectores' && a.admin ? ' · Montu Admin' : '')}
              href={dest(tab, tab === 'agentes' ? a.id : 'mcp-' + a.id)}
            />,
          );
      }
    if (tab === 'conectores')
      for (const s of p.fuentes)
        if (matches(s.nombre, p.nombre))
          rows.push(
            <Item
              key={p.persona + s.id}
              icon={<SourceLogo id={s.id} />}
              title={s.nombre}
              subtitle={p.nombre + ' · ' + s.estado}
              href={dest(tab, s.id)}
            />,
          );
  }
  return (
    <div
      className="admin-directory"
      onClick={(e) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || !(e.target instanceof Element))
          return;
        const a = e.target.closest('a');
        if (!a || a.target || a.origin !== location.origin || a.pathname !== '/admin' || new URLSearchParams(a.search).has('panel')) return;
        e.preventDefault();
        history.pushState(null, '', a.href);
        setQuery(a.search);
        setFilter(new URLSearchParams(a.search).get('buscar') ?? '');
        window.scrollTo(0, 0);
      }}
    >
      <AdminBinding />
      {id ? (
        profile ? (
          <ProfileView key={id} id={id} stats={profile} tab={tab} item={params.get('item')} />
        ) : (
          <>
            <Back href="/admin">Directorio</Back>
            <Empty>Persona no disponible.</Empty>
          </>
        )
      ) : (
        <>
          <div className="admin-heading">
            <SectionHead title="Directorio" first />
            <a className="admin-back" href="/admin?panel=rondas">
              Panel de rondas ›
            </a>
          </div>
          <div className="rd-actions">
            <a className="rd-button rd-button--quiet app-link" href={personUrl(directory.yo)}>
              Mi contexto
            </a>
          </div>
          <Tabs tabs={['personas', 'agentes', 'contextos', 'conectores']} selected={tab} link={(t) => listUrl(t)} />
          <div className="rd-actions">
            {[
              <a key="all" aria-current={!team ? 'true' : undefined} href={listUrl(tab, null)}>
                Todos
              </a>,
              ...directory.equipos.map((t) => (
                <a key={t.id} aria-current={team === t.id ? 'true' : undefined} href={listUrl(tab, t.id)}>
                  {t.nombre}
                </a>
              )),
            ]}
          </div>
          <input
            className="rd-input"
            aria-label={'Buscar en ' + (labels[tab] ?? 'directorio')}
            placeholder={'Buscar en ' + (labels[tab] ?? 'directorio').toLowerCase()}
            value={filter}
            onChange={(e) => {
              const value = e.target.value;
              setFilter(value);
              const next = new URLSearchParams(location.search);
              if (value) next.set('buscar', value);
              else next.delete('buscar');
              history.replaceState(null, '', route(Object.fromEntries(next)));
              setQuery(location.search);
            }}
          />
          <section className="rd-card rd-glass">
            <h2>
              {labels[tab]} · {rows.length}
            </h2>
            {rows.length ? rows : <Empty>Sin resultados para esta selección.</Empty>}
          </section>
        </>
      )}
      <div className="rd-actions">
        <span className="rd-note">Enlace a esta vista</span>
        <CopyButton label="Copiar enlace a esta vista" text={location.origin + '/admin' + query} />
      </div>
    </div>
  );
}
