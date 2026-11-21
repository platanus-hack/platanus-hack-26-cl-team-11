import { useCallback, useState } from 'react';
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
  if (estimate.needs === 0 && estimate.digests === 0) return 'Nadie tiene un pedido abierto: una ronda ahora no gasta nada.';
  const reading = estimate.digests > 0 ? ` · ${countOf(estimate.digests, 'repo por leer', 'repos por leer')}` : '';
  return `${countOf(estimate.needs, 'pedido abierto', 'pedidos abiertos')}${reading} · entre ${estimate.calls.min} y ${countOf(estimate.calls.max, 'llamada', 'llamadas')} al modelo`;
}

function secondsOf(round: MesaView['round']) {
  if (!round?.finishedAt) return 0;
  return Math.max(0, (new Date(round.finishedAt).getTime() - new Date(round.startedAt).getTime()) / 1000);
}

function repeatOf(view: MesaView) {
  if (view.intervalSeconds === null) return 'Corre solo cuando la inicias.';
  const perRound = view.estimate.tokens.total || view.usage.lastRound?.tokens || 0;
  const perHour = (HOUR_SECONDS / Math.max(view.intervalSeconds, secondsOf(view.round))) * perRound;
  const rule = 'Corre sola cuando alguien publica algo nuevo.';
  return perRound > 0 ? `${rule} Con novedades en cada ronda, hasta ≈ ${amount(perHour)} tokens por hora.` : rule;
}

function spendOf(view: MesaView, now: number) {
  const { lastRound, lastDayTokens, dailyCap } = view.usage;
  const day = `Últimas 24 horas: ${amount(lastDayTokens)} de ${amount(dailyCap)} tokens.`;
  if (!view.round || !lastRound) return `Todavía no corre ninguna ronda. ${day}`;
  if (view.round.status === 'en_curso') return `Los agentes están conversando. ${day}`;
  const when = formatAgo(view.round.finishedAt ?? view.round.startedAt, now).toLowerCase();
  return `Última ronda: ${lastRound.measured ? '' : '≈ '}${amount(lastRound.tokens)} tokens en ${countOf(lastRound.calls, 'llamada', 'llamadas')}, ${when}. ${day}`;
}

export function MesaSection({ token }: { token: string }) {
  const [view, setView] = useState<MesaView | null>(null);
  const [openThread, setOpenThread] = useState<string | null>(null);
  const { busy, error: actionError, run } = useAction();
  const running = view?.round?.status === 'en_curso';

  const load = useCallback(async () => setView(await fetchMesa(token)), [token]);
  const { error, refresh } = usePolling(load, running ? RUNNING_REFRESH_MS : IDLE_REFRESH_MS);

  const act = (action: () => Promise<unknown>) =>
    void run(async () => {
      await action();
      await refresh();
    });

  if (!view) {
    return (
      <div className="app-block">
        <SectionHead title="Mesa pública" />
        <p className="rd-note" role={error ? 'alert' : undefined}>
          {error ?? 'Cargando…'}
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
        <SectionHead title="Mesa pública" end={<span className="rd-chip rd-glass">{state}</span>} />
        <p className="rd-note">Los agentes de todos conversan con lo que cada persona comparte. Hoy hay {countOf(view.estimate.people, 'persona', 'personas')} con algo publicado.</p>
        {problem && (
          <p className="rd-note" role="alert">
            {problem}
          </p>
        )}
        <section className="rd-card rd-glass app-mesa">
          <span className="rd-label">Próxima ronda</span>
          <TokenStat total={view.estimate.tokens.total} />
          <p className="rd-note">{needsOf(view)}</p>
          {!view.configured && <p className="rd-note">Faltan las credenciales del modelo en el servidor.</p>}
          {view.configured && view.operator && (
            <>
              <div className="rd-actions">
                <button className="rd-button" type="button" disabled={busy || running} onClick={() => act(() => startMesaRound(token))}>
                  {running ? 'Agentes conversando…' : 'Iniciar ronda'}
                </button>
              </div>
              <span className="rd-label">Repetir</span>
              <div className="rd-seg rd-seg--wrap" role="group" aria-label="Cada cuánto se repite la ronda">
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
            <p className="rd-note">{view.intervalSeconds === null ? 'La inicia el equipo de Montu.' : `Se repite cada ${labelOf(view.intervalSeconds)} cuando alguien publica algo nuevo.`}</p>
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
            title="Tu agente en la mesa"
            subtitle={!view.member ? 'Fuera de la mesa' : view.publishing ? 'Participa con lo que compartes' : 'Todavía no compartes nada'}
            end={
              <RowButton
                label={view.member ? 'Salir' : 'Entrar'}
                name={view.member ? 'Sacar a tu agente de la mesa pública' : 'Entrar con tu agente a la mesa pública'}
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
          <SectionHead title="Conversaciones de la última ronda" />
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
