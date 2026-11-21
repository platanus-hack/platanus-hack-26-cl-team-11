import { useCallback, useEffect, useState } from 'react';
import { formatAgo } from './ago';
import { fetchMesa, setMesaInterval, setMesaMembership, startMesaRound, type MesaView } from './api';
import { AskRow } from './AskRow';
import { countOf } from './format';
import { Glyph } from './Glyph';
import { Item } from './Item';
import { ItemIcon } from './ItemIcon';
import { ProposalRow } from './ProposalRow';
import { RowButton } from './RowButton';
import { SectionHead } from './SectionHead';
import { ThreadRow } from './ThreadRow';
import { useAction } from './useAction';
import { useCountUp } from './useCountUp';
import { usePolling } from './usePolling';
import { MontuInline } from './MontuLoader';

const INTERVALS: ReadonlyArray<{ seconds: number | null; label: string }> = [
  { seconds: null, label: 'Manual' },
  { seconds: 10, label: '10 s' },
  { seconds: 30, label: '30 s' },
  { seconds: 60, label: '1 min' },
  { seconds: 300, label: '5 min' },
  { seconds: 900, label: '15 min' },
];
const HOUR_SECONDS = 3600;
const RUNNING_REFRESH_MS = 2000;
const IDLE_REFRESH_MS = 5000;

const amount = (value: number) => Math.round(value).toLocaleString('es-CL');
const labelOf = (seconds: number) => INTERVALS.find((option) => option.seconds === seconds)?.label ?? `${seconds} s`;

function TokenStat({ total }: { total: number }) {
  const shown = useCountUp(total);
  return (
    <span className="rd-stat">
      {total > 0 && '≈ '}
      {amount(shown)}
      <span className="rd-stat__unit">tokens</span>
    </span>
  );
}

function needsOf(view: MesaView) {
  const { estimate } = view;
  if (estimate.people < 2) return 'Faltan al menos dos personas con algo publicado.';
  if (estimate.needs === 0 && estimate.digests === 0) return 'No hay nada publicado para conversar todavía.';
  const reading = estimate.digests > 0 ? ` · ${countOf(estimate.digests, 'repo por leer', 'repos por leer')}` : '';
  return `${countOf(estimate.needs, 'tema', 'temas')}${reading} · entre ${estimate.calls.min} y ${countOf(estimate.calls.max, 'llamada', 'llamadas')} al modelo`;
}

function secondsOf(round: MesaView['round']) {
  if (!round?.finishedAt) return 0;
  return Math.max(0, (new Date(round.finishedAt).getTime() - new Date(round.startedAt).getTime()) / 1000);
}

function repeatOf(view: MesaView) {
  if (view.intervalSeconds === null) return 'Solo cuando aprietas el botón.';
  const perRound = view.estimate.tokens.total || view.usage.lastRound?.tokens || 0;
  const perHour = (HOUR_SECONDS / Math.max(view.intervalSeconds, secondsOf(view.round))) * perRound;
  const rule = 'Solo si alguien publicó algo nuevo.';
  return perRound > 0 ? `${rule} Como mucho ≈ ${amount(perHour)} tokens por hora.` : rule;
}

function spendOf(view: MesaView, now: number) {
  const { lastRound, lastDayTokens, dailyCap } = view.usage;
  const day = `Últimas 24 horas: ${amount(lastDayTokens)} de ${amount(dailyCap)} tokens.`;
  if (!view.round || !lastRound) return `Todavía no conversan. ${day}`;
  if (view.round.status === 'en_curso') return `Están conversando. ${day}`;
  const when = formatAgo(view.round.finishedAt ?? view.round.startedAt, now).toLowerCase();
  const talks = countOf(view.threads.length, 'conversación', 'conversaciones');
  return `La última vez, ${when}: ${talks}, ${lastRound.measured ? '' : '≈ '}${amount(lastRound.tokens)} tokens en ${countOf(lastRound.calls, 'llamada', 'llamadas')}. ${day}`;
}

export function MesaSection({ token, onRound }: { token: string; onRound: (startedHere: boolean) => void }) {
  const [view, setView] = useState<MesaView | null>(null);
  const [openThread, setOpenThread] = useState<string | null>(null);
  const { busy, error: actionError, run } = useAction();
  const running = view?.round?.status === 'en_curso';

  const load = useCallback(async () => setView(await fetchMesa(token)), [token]);
  const { error, refresh } = usePolling(load, running ? RUNNING_REFRESH_MS : IDLE_REFRESH_MS);

  useEffect(() => {
    if (running) onRound(false);
  }, [running, onRound]);

  const act = (action: () => Promise<unknown>) =>
    void run(async () => {
      await action();
      await refresh();
    });

  if (!view) {
    return (
      <div className="app-block">
        <SectionHead title="Agentes" />
        <p className="rd-note" role={error ? 'alert' : undefined}>
          {error ?? <MontuInline />}
        </p>
      </div>
    );
  }

  const state = running ? 'En curso' : view.intervalSeconds === null ? 'Manual' : `Cada ${labelOf(view.intervalSeconds)}`;
  const problem = actionError ?? error ?? view.round?.problem ?? null;
  const forMe = view.asks.length > 0 || view.proposals.length > 0;

  return (
    <>
      <div className="app-block">
        <SectionHead title="Agentes" end={<span className="rd-chip rd-glass">{state}</span>} />
        <p className="rd-note">Los agentes conversan entre ellos con lo que cada persona comparte y proponen en qué ayudarse. Hoy hay {countOf(view.estimate.people, 'persona', 'personas')} con algo publicado.</p>
        {problem && (
          <p className="rd-note" role="alert">
            {problem}
          </p>
        )}
        <section className="rd-card rd-glass app-mesa">
          <span className="rd-label">Si conversan ahora</span>
          <TokenStat total={view.estimate.tokens.total} />
          <p className="rd-note">{needsOf(view)}</p>
          {!view.configured && <p className="rd-note">Faltan las credenciales del modelo en el servidor.</p>}
          {view.configured && view.operator && (
            <>
              <div className="rd-actions">
                <button className="rd-button" type="button" disabled={busy || running} onClick={() => act(() => startMesaRound(token).then(() => onRound(true)))}>
                  {running ? 'Conversando…' : 'Que conversen'}
                </button>
              </div>
              <span className="rd-label">Que vuelvan a conversar solos</span>
              <div className="rd-seg rd-seg--wrap" role="group" aria-label="Cada cuánto vuelven a conversar">
                {INTERVALS.map((option) => (
                  <button key={option.label} type="button" aria-pressed={view.intervalSeconds === option.seconds} disabled={busy} onClick={() => act(() => setMesaInterval(token, option.seconds))}>
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="rd-note">{repeatOf(view)}</p>
            </>
          )}
          {view.configured && !view.operator && (
            <p className="rd-note">{view.intervalSeconds === null ? 'Las inicia el equipo de Montu.' : `Vuelven a conversar cada ${labelOf(view.intervalSeconds)} si alguien publicó algo nuevo.`}</p>
          )}
          <p className="rd-note">{spendOf(view, Date.now())}</p>
        </section>
        <div className="rd-list">
          <Item
            icon={
              <ItemIcon>
                <Glyph name="globe" />
              </ItemIcon>
            }
            title="Tu agente conversa con los demás"
            subtitle={!view.member ? 'No conversa con nadie' : view.publishing ? 'Participa con lo que compartes' : 'Todavía no compartes nada'}
            end={
              <RowButton
                label={view.member ? 'Salir' : 'Entrar'}
                name={view.member ? 'Que tu agente no converse con los demás' : 'Que tu agente converse con los demás'}
                disabled={busy}
                onClick={() => act(() => setMesaMembership(token, !view.member))}
              />
            }
          />
        </div>
      </div>
      {forMe && (
        <div className="app-block">
          <SectionHead title="Para ti" />
          <div className="rd-list">
            {view.asks.map((ask) => (
              <AskRow key={ask.topic} token={token} ask={ask} onChange={refresh} />
            ))}
            {view.proposals.map((proposal) => (
              <ProposalRow key={proposal.id} token={token} proposal={proposal} onChange={refresh} />
            ))}
          </div>
        </div>
      )}
      {view.threads.length > 0 && (
        <div className="app-block">
          <SectionHead title="Lo que conversaron" />
          <div className="rd-list">
            {view.threads.map((thread) => (
              <ThreadRow key={thread.id} thread={thread} open={openThread === thread.id} onToggle={() => setOpenThread((current) => (current === thread.id ? null : thread.id))} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
