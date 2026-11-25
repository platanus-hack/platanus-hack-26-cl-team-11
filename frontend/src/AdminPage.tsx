import { useCallback, useEffect, useState } from 'react';
import { AdminBinding } from './AdminBinding';
import { formatAgo } from './ago';
import { fetchAdmin, fetchSessionPerson, setGlobeMode, setMesaInterval, startMesaRound, type AdminRound, type AdminView, type GlobeMode } from './api';
import { countOf } from './format';
import { Item } from './Item';
import { MontuInline } from './MontuLoader';
import { SectionHead } from './SectionHead';
import { useAction } from './useAction';
import { usePolling } from './usePolling';

const GLOBE: ReadonlyArray<{ mode: GlobeMode; label: string }> = [
  { mode: 'mesa', label: 'En vivo' },
  { mode: 'demo', label: 'Demo' },
];
const INTERVALS: ReadonlyArray<{ seconds: number | null; label: string }> = [
  { seconds: null, label: 'Manual' },
  { seconds: 10, label: '10 s' },
  { seconds: 30, label: '30 s' },
  { seconds: 60, label: '1 min' },
  { seconds: 300, label: '5 min' },
  { seconds: 900, label: '15 min' },
];
const STATUS: Record<AdminRound['status'], string> = { en_curso: 'En curso', lista: 'Lista', fallida: 'Falló' };
const RUNNING_REFRESH_MS = 2000;
const IDLE_REFRESH_MS = 6000;

const amount = (value: number) => Math.round(value).toLocaleString('es-CL');

function RoundRow({ round, now }: { round: AdminRound; now: number }) {
  return (
    <Item
      icon={<span className="rd-chip rd-glass">{STATUS[round.status]}</span>}
      title={`${formatAgo(round.startedAt, now)} · ${countOf(round.threads, 'conversación', 'conversaciones')}`}
      subtitle={`${amount(round.tokens)} tokens en ${countOf(round.calls, 'llamada', 'llamadas')}`}
    />
  );
}

function Panel({ token }: { token: string }) {
  const [view, setView] = useState<AdminView | null>(null);
  const { busy, error: actionError, run } = useAction();
  const running = view?.rounds[0]?.status === 'en_curso';
  const load = useCallback(async () => setView(await fetchAdmin(token)), [token]);
  const { error, refresh } = usePolling(load, running ? RUNNING_REFRESH_MS : IDLE_REFRESH_MS);

  const act = (action: () => Promise<unknown>) =>
    void run(async () => {
      await action();
      await refresh();
    });

  if (!view)
    return (
      <p className="rd-note" role={error ? 'alert' : undefined}>
        {error ?? <MontuInline />}
      </p>
    );

  const now = Date.now();
  const problem = actionError ?? error;
  const publishing = view.people.filter((person) => person.member && person.publishing).length;

  return (
    <>
      <AdminBinding />
      <div className="app-block">
        <SectionHead title="Panel" first end={<span className="rd-chip rd-glass">{running ? 'Conversando' : 'En pausa'}</span>} />
        {problem && (
          <p className="rd-note" role="alert">
            {problem}
          </p>
        )}
        <section className="rd-card rd-glass app-mesa">
          <span className="rd-label">El globo abre en</span>
          <div className="rd-seg" role="group" aria-label="Qué muestra el globo">
            {GLOBE.map((option) => (
              <button key={option.mode} type="button" aria-pressed={view.globeMode === option.mode} disabled={busy} onClick={() => act(() => setGlobeMode(token, option.mode))}>
                {option.label}
              </button>
            ))}
          </div>
          <span className="rd-label">Ronda</span>
          <div className="rd-actions">
            <button className="rd-button" type="button" disabled={busy || running || !view.configured} onClick={() => act(() => startMesaRound(token))}>
              {running ? 'Conversando…' : 'Que conversen ahora'}
            </button>
          </div>
          {!view.configured && <p className="rd-note">Faltan las credenciales del modelo en el servidor.</p>}
          <span className="rd-label">Que vuelvan a conversar solos</span>
          <div className="rd-seg rd-seg--wrap" role="group" aria-label="Cada cuánto vuelven a conversar">
            {INTERVALS.map((option) => (
              <button key={option.label} type="button" aria-pressed={view.intervalSeconds === option.seconds} disabled={busy} onClick={() => act(() => setMesaInterval(token, option.seconds))}>
                {option.label}
              </button>
            ))}
          </div>
          <p className="rd-note">
            {countOf(view.people.length, 'persona', 'personas')}, {publishing} con algo publicado. Últimas 24 horas: {amount(view.usage.lastDayTokens)} de {amount(view.usage.dailyCap)} tokens.
          </p>
        </section>
      </div>
      <div className="app-block">
        <SectionHead title="Estado de las rondas" />
        {view.rounds.length === 0 && <p className="rd-note">Todavía no conversan.</p>}
        <div className="rd-list">
          {view.rounds.map((round) => (
            <RoundRow key={round.id} round={round} now={now} />
          ))}
        </div>
      </div>
    </>
  );
}

export function AdminPage({ token }: { token?: string }) {
  const [resolved, setResolved] = useState<string | null | undefined>(token);

  useEffect(() => {
    if (token) return;
    fetchSessionPerson()
      .catch(() => null)
      .then((person) => setResolved(person?.token ?? null));
  }, [token]);

  if (resolved === undefined) return <MontuInline />;
  if (resolved === null)
    return (
      <p className="rd-note">
        Entra primero a <a href="/">Montu</a> con tu cuenta del equipo.
      </p>
    );
  return <Panel token={resolved} />;
}
