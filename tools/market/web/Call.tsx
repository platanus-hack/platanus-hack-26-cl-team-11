import { useEffect, useState } from 'react';
import { clock, move, read, save, saved, teamLabel } from './market';
type Side = { team: string; price: number };
type Call = { start: number; end: number; pick: Side; rival: Side };
type Result = { call: Call; state: string; moves?: number[]; winner?: string };
export function CallDesk({ team, fresh, rival }: { team: string; fresh: boolean; rival: string }) {
  const shared = new URLSearchParams(location.search).get('call');
  const [ticket, setTicket] = useState(() => shared || saved('ticket', ''));
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!ticket) return;
    let active = true,
      timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const r = await fetch('/api/calls?ticket=' + encodeURIComponent(ticket), {
          signal: AbortSignal.timeout(10000),
        });
        if (!active) return;
        if (r.status === 400) {
          setError('El enlace tiene un comprobante inválido.');
          return;
        }
        if (!r.ok) throw Error();
        const value = (await r.json()) as Result;
        if (!active) return;
        setResult(value);
        setError('');
        if (value.state === 'settled') return;
        timer = setTimeout(
          poll,
          value.state === 'open' ? Math.max(800, Math.min(30000, value.call.end - Date.now() + 500)) : 10000,
        );
      } catch {
        if (active) {
          setError('Reconectando para verificar el resultado…');
          timer = setTimeout(poll, 8000);
        }
      }
    };
    void poll();
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      active = false;
      clearTimeout(timer);
      clearInterval(tick);
    };
  }, [ticket]);
  async function start() {
    setBusy(true);
    setError('');
    try {
      const r = await read<{ call: Call; ticket: string }>('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team }),
      });
      save('ticket', r.ticket);
      setTicket(r.ticket);
      setResult({ call: r.call, state: 'open' });
      setNow(Date.now());
    } catch {
      setError('No se pudo abrir el pronóstico. Espera una cotización reciente.');
    } finally {
      setBusy(false);
    }
  }
  function reset() {
    const url = new URL(location.href);
    url.searchParams.delete('call');
    history.replaceState(null, '', url);
    const own = shared ? saved('ticket', '') : '';
    const next = own === ticket ? '' : own;
    setTicket(next);
    setResult(null);
    save('ticket', next);
    setError('');
  }
  const seconds = Math.ceil(Math.max(0, (result?.call.end ?? 0) - now) / 1000);
  return (
    <section className="rd-decision" id="call">
      <div className="rd-decision__body">
        <span className="rd-decision__label rd-gradient-text">Pronóstico de cinco minutos</span>
        <h2 className="rd-title">
          {result
            ? teamLabel(result.call.pick.team) + ' vs. ' + teamLabel(result.call.rival.team)
            : 'Desafía al favorito'}
        </h2>
        {!ticket && (
          <>
            <p>
              Tu agente elige {teamLabel(team)}. El rival toma {teamLabel(rival)}, el equipo de mayor precio disponible.
              Gana el que más suba en porcentaje.
            </p>
            <button className="rd-button" disabled={!fresh || busy} onClick={start}>
              {busy ? 'Fijando precios…' : 'Fijar mi pronóstico'}
            </button>
          </>
        )}
        {result && (
          <>
            <span className="rd-stat">
              {result.state === 'settled'
                ? result.winner === 'pick'
                  ? 'Ganaste'
                  : result.winner === 'tie'
                  ? 'Empate'
                  : 'Ganó el rival'
                : seconds
                ? Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0')
                : 'Verificando'}
            </span>
            <p className="rd-note">
              {clock(result.call.start)} → {clock(result.call.end)}
              {result.moves ? ' · ' + result.moves.map(move).join(' / ') : ' · Cotizaciones de Platanus'}
            </p>
            <a href={'?call=' + encodeURIComponent(ticket) + '#call'}>Enlace al pronóstico</a>
          </>
        )}
        {ticket && !result && !error && <p>Cargando comprobante…</p>}
        {error && (
          <span role="status" className="rd-note">
            {error}
          </span>
        )}
        {ticket && (shared || result?.state === 'settled' || (!result && error)) && (
          <button className="rd-button rd-button--quiet" onClick={reset}>
            Volver a mi mesa
          </button>
        )}
      </div>
    </section>
  );
}
