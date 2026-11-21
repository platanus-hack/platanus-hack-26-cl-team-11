import { useEffect, useRef, useState } from 'react';
import { Arena } from './Arena';
import { CallDesk } from './Call';
import { type Board, type Team, type Series, clock, label, move, pct, read, teamLabel, saved, save } from './market';
import './terminal.css';

function TapeChart({ series }: { series: Series }) {
  const points = series.points;
  const vals = points.map((p) => p[1]),
    lo = Math.min(...vals),
    hi = Math.max(...vals);
  const start = points[0]![0],
    end = points.at(-1)![0];
  const x = (t: number) => 2 + (596 * (t - start)) / Math.max(1, end - start);
  const y = (v: number) => (hi === lo ? 54 : 100 - (90 * (v - lo)) / (hi - lo));
  const line = points.map(([t, v], i) => (i ? 'H' + x(t) + 'V' + y(v) : 'M' + x(t) + ' ' + y(v))).join(' ');
  return (
    <figure className="market-chart">
      <div className="rd-note">Máx. {pct(hi)}</div>
      <svg
        viewBox="0 0 600 110"
        preserveAspectRatio="none"
        role="img"
        aria-label={'Precio de ' + teamLabel(series.team) + ' entre ' + pct(lo) + ' y ' + pct(hi)}
      >
        {[10, 55, 100].map((n) => (
          <line key={n} x1="0" x2="600" y1={n} y2={n} stroke="var(--rd-hairline)" vectorEffect="non-scaling-stroke" />
        ))}
        <path d={line} fill="none" stroke="currentColor" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="rd-note">Mín. {pct(lo)}</div>
      <figcaption className="rd-note">
        <span>{clock(start)}</span>
        <span>{clock(end)}</span>
      </figcaption>
    </figure>
  );
}
type Flow = { at: number; team: string; delta: number };
export function Terminal() {
  const [board, setBoard] = useState<Board | null>(null),
    [base, setBase] = useState<Board | null>(null);
  const [online, setOnline] = useState(false),
    [failed, setFailed] = useState(false);
  const [series, setSeries] = useState<Series | null>(null),
    [seriesError, setSeriesError] = useState(false);
  const [selection, setSelection] = useState(() => new URLSearchParams(location.search).get('team') || '');
  const [filter, setFilter] = useState(''),
    [sort, setSort] = useState('price');
  const [watch, setWatch] = useState<string[]>(() => saved('watch', [])),
    [only, setOnly] = useState(false);
  const [tape, setTape] = useState<Flow[]>([]);
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let active = true,
      timer: ReturnType<typeof setTimeout>,
      previous: Board | null = null;
    const last = saved<Board | null>('board', null);
    if (last?.teams?.length) setBoard(last);
    else
      read<Board>('/last-market.json')
        .then((b) => {
          if (active) setBoard((prior) => prior ?? b);
        })
        .catch(() => {});
    async function poll() {
      try {
        const b = await read<Board>('/api/terminal');
        if (!active) return;
        const fresh = Math.abs(Date.now() - b.at) < 30000;
        setOnline(fresh);
        setFailed(false);
        setBoard(b);
        save('board', b);
        if (!fresh || !previous || b.at - previous.at > 60000 || b.at < previous.at) {
          setBase(b);
          setTape([]);
        } else if (previous.at < b.at) {
          const old = new Map(previous.teams.map((t) => [t.team, t.q]));
          const changes = b.teams
            .filter((t) => old.has(t.team) && old.get(t.team) !== t.q)
            .map((t) => ({ at: b.at, team: t.team, delta: t.q - old.get(t.team)! }))
            .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
          if (changes.length) setTape((t) => [...changes, ...t].slice(0, 12));
        }
        previous = b;
      } catch {
        if (active) {
          setOnline(false);
          setFailed(true);
        }
      }
      if (active) timer = setTimeout(poll, 10000);
    }
    void poll();
    function shortcut(e: KeyboardEvent) {
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        search.current?.focus();
      }
    }
    window.addEventListener('keydown', shortcut);
    return () => {
      active = false;
      clearTimeout(timer);
      window.removeEventListener('keydown', shortcut);
    };
  }, []);
  const teams = board?.teams ?? [],
    instrument = teams.find((t) => t.team === selection) ?? teams[0];
  const slug = instrument?.team;
  useEffect(() => {
    if (!slug) return;
    let active = true,
      timer: ReturnType<typeof setTimeout>;
    setSeries(null);
    setSeriesError(false);
    async function fetchSeries() {
      try {
        const s = await read<Series>('/api/terminal?team=' + slug);
        if (active) {
          setSeries(s);
          setSeriesError(false);
        }
      } catch {
        if (active) setSeriesError(true);
      }
      if (active) timer = setTimeout(fetchSeries, 20000);
    }
    void fetchSeries();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [slug]);
  const bench = teams.find((t) => t.team !== slug);
  const starts = new Map(base?.teams.map((t) => [t.team, t]));
  const delta = (t: Team) => {
    const prev = starts.get(t.team);
    return prev ? t.price / prev.price - 1 : 0;
  };
  const net = (t: Team) => t.q - (starts.get(t.team)?.q ?? t.q);
  const rows = teams
    .filter(
      (t) =>
        (!only || watch.includes(t.team)) &&
        [t.team, t.name, teamLabel(t.team)].join(' ').toLowerCase().includes(filter.toLowerCase().trim()),
    )
    .sort((a, b) =>
      sort === 'move' ? delta(b) - delta(a) : sort === 'flow' ? Math.abs(net(b)) - Math.abs(net(a)) : b.price - a.price,
    );
  function select(team: string) {
    setSelection(team);
    const url = new URL(location.href);
    url.searchParams.set('team', team);
    history.replaceState(null, '', url);
  }
  function star(team: string) {
    const next = watch.includes(team) ? watch.filter((t) => t !== team) : [...watch, team];
    setWatch(next);
    save('watch', next);
  }
  const current = series?.team === slug ? series : null;
  return (
    <div className="market-terminal">
      <div className="market-heading">
        <h1 className="rd-hero">Terminal de mercado</h1>
        <span className="rd-chip rd-chip--status rd-glass">
          {online && <i className="rd-dot" />}
          {online ? 'En línea' : failed ? 'Fuente en pausa' : board ? 'Última lectura' : 'Conectando'}
          {board ? ' · ' + clock(board.at) : ''}
        </span>
      </div>
      <div className="market-columns">
        <div className="rd-stack">
          {instrument && (
            <section className="rd-card rd-glass market-box">
              <div className="rd-head">
                <div>
                  <span className="rd-label">
                    {instrument.team} · {instrument.presenting ? 'Presentando ahora' : 'Cotización'}
                  </span>
                  <h2 className="rd-title">{label(instrument)}</h2>
                </div>
                <button
                  className="rd-button rd-button--quiet rd-button--small"
                  aria-pressed={watch.includes(instrument.team)}
                  onClick={() => star(instrument.team)}
                >
                  {watch.includes(instrument.team) ? 'Siguiendo' : 'Seguir equipo'}
                </button>
              </div>
              <div className="rd-stat-row">
                <span className="rd-stat">{pct(instrument.price)}</span>
                <span className="rd-note">
                  {current?.change5m != null ? move(current.change5m) + ' en 5 min' : 'Precio marginal'}
                </span>
              </div>
              {current ? (
                <>
                  <TapeChart series={current} />
                  {seriesError && <small>Gráfico de la última lectura disponible.</small>}
                </>
              ) : (
                <p className="rd-note">
                  {seriesError ? 'Historia temporalmente en pausa.' : 'Cargando los últimos 30 minutos…'}
                </p>
              )}
              {instrument.description && <p className="rd-note">{instrument.description}</p>}
            </section>
          )}
          <section className="rd-card rd-glass market-box">
            <div className="rd-head">
              <h2 className="rd-title">Equipos</h2>
              <span className="rd-note">
                {rows.length} de {teams.length}
              </span>
            </div>
            <div className="market-controls">
              <input
                className="rd-input"
                ref={search}
                aria-label="Buscar equipo"
                placeholder="Buscar equipo  /"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && rows[0]) select(rows[0].team);
                }}
              />
              <select
                className="rd-input"
                aria-label="Ordenar equipos"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="price">Precio</option>
                <option value="move">Mayor alza</option>
                <option value="flow">Mayor flujo</option>
              </select>
              <button
                className="rd-button rd-button--quiet rd-button--small"
                aria-pressed={only}
                onClick={() => setOnly(!only)}
              >
                {only ? 'Ver todos' : 'Seguidos'}
              </button>
            </div>
            <div className="market-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Equipo</th>
                    <th>Precio</th>
                    <th>Cambio</th>
                    <th>Flujo neto</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => (
                    <tr key={t.id} aria-selected={t.team === slug}>
                      <td>
                        <button className="app-pick" onClick={() => select(t.team)}>
                          <span>{label(t)}</span>
                          {t.name !== t.team && <small className="rd-note"> · {t.team}</small>}
                        </button>
                      </td>
                      <td>{pct(t.price)}</td>
                      <td>{base ? move(delta(t)) : '—'}</td>
                      <td>{base ? net(t).toLocaleString('es-CL') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!rows.length && (
              <p className="rd-note">
                {only ? 'Sigue un equipo desde su ficha para verlo aquí.' : 'Sin coincidencias.'}
              </p>
            )}
            <p className="rd-note">
              Cambio de precio y saldo de acciones desde {base ? clock(base.at) : 'la primera lectura en vivo'}.
            </p>
          </section>
        </div>
        <aside className="rd-stack">
          {instrument && bench && (
            <CallDesk team={instrument.team} rival={bench.team} fresh={online && board?.status === 'open'} />
          )}
          <Arena />
          <section className="rd-card rd-glass market-box">
            <h2 className="rd-title">Cinta de flujo</h2>
            {tape.length ? (
              <div>
                {tape.slice(0, 5).map((e) => (
                  <div className="rd-row" key={e.at + e.team}>
                    <small className="rd-note">{clock(e.at)}</small>
                    <button className="app-pick" onClick={() => select(e.team)}>
                      {teamLabel(e.team)}
                    </button>
                    <span>
                      {e.delta > 0 ? '+' : ''}
                      {e.delta.toLocaleString('es-CL')}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rd-note">
                Esperando cambios de inventario entre dos lecturas. Cada línea muestra el saldo neto de acciones de un
                equipo.
              </p>
            )}
          </section>
          <section className="rd-card rd-glass market-box" id="agents">
            <h2 className="rd-title">Conecta tu agente</h2>
            <p className="rd-note">Lee el mercado, fija un pronóstico y verifica su resultado con el comprobante.</p>
            <a href="/agent.md">Instrucciones y ejemplos de API ↗</a>
          </section>
        </aside>
      </div>
    </div>
  );
}
