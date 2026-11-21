import { useCallback, useEffect, useRef, useState } from 'react';
import { clock, pct, read, type Board } from './market';
import { MarketActivity, Resolution, WalletPanel } from './exchange/Activity';
import { KindIcon, Payoff } from './exchange/Payoff';
import { ListForm } from './exchange/ListForm';
import { OrderForm, type Quote } from './exchange/OrderForm';
import {
  getToken,
  kinds,
  n,
  states,
  subject,
  teamText,
  when,
  type Command,
  type Market,
  type View,
} from './exchange/types';
import './exchange.css';

const initialId = () => new URLSearchParams(location.search).get('marketId') ?? '';
const endpoint = (id: string) => '/api/exchange' + (id ? '?marketId=' + encodeURIComponent(id) : '');
const href = (id: string) => location.pathname + '?marketId=' + encodeURIComponent(id);
type Operation = { command: Command; nonce: string; target: string };
type Notice = { text: string; retry?: Operation };
const receiptKey = 'mesa26.exchange.pending.v1';

function remembered(): Operation | null {
  try {
    return JSON.parse(sessionStorage.getItem(receiptKey) || 'null');
  } catch {
    return null;
  }
}
function remember(op: Operation | null) {
  try {
    if (op) sessionStorage.setItem(receiptKey, JSON.stringify(op));
    else sessionStorage.removeItem(receiptKey);
  } catch {
    /* Browser storage can be disabled. */
  }
}
function MarketDirectory({
  markets,
  active,
  select,
}: {
  markets: Market[];
  active?: string;
  select: (id: string) => void;
}) {
  const rail = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState('');
  const sorted = markets
    .filter((m) => !filter || m.kind === filter)
    .sort((a, b) => Number(b.status === 'open') - Number(a.status === 'open'));
  return (
    <section className="ex-directory" aria-label="Explorar contratos">
      <div className="ex-section-head">
        <h2 className="rd-title">Mercados</h2>
        <div className="ex-picker">
          <select
            className="rd-input"
            aria-label="Filtrar por tipo de contrato"
            value={filter}
            onChange={(e) => {
              const kind = e.target.value;
              setFilter(kind);
              const first =
                markets.find((m) => m.kind === kind && m.status === 'open') ?? markets.find((m) => m.kind === kind);
              if (first && markets.find((m) => m.id === active)?.kind !== kind) select(first.id);
            }}
          >
            <option value="">Todos los tipos</option>
            {Object.entries(kinds).map(([id, label]) => (
              <option value={id} key={id}>
                {label}
              </option>
            ))}
          </select>
          <select
            className="rd-input"
            aria-label="Elegir mercado"
            value={sorted.some((m) => m.id === active) ? active : ''}
            onChange={(e) => select(e.target.value)}
          >
            {!sorted.some((m) => m.id === active) && <option value="">Selecciona un mercado</option>}
            {sorted.map((m) => (
              <option key={m.id} value={m.id}>
                {teamText(m.title)} · {states[m.status]} · {when(m.expiry)}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="rd-iconbutton"
            aria-label="Mercados anteriores"
            onClick={() => rail.current?.scrollBy({ left: -360 })}
          >
            ‹
          </button>
          <button
            type="button"
            className="rd-iconbutton"
            aria-label="Más mercados"
            onClick={() => rail.current?.scrollBy({ left: 360 })}
          >
            ›
          </button>
        </div>
      </div>
      {!sorted.length && <p className="rd-note">Todavía no hay mercados de este tipo.</p>}
      <div className="ex-rail" ref={rail}>
        {sorted.map((m) => (
          <button
            key={m.id}
            type="button"
            className="rd-glass ex-card-pick"
            aria-pressed={m.id === active}
            onClick={() => select(m.id)}
          >
            <span className="ex-tile-top">
              <KindIcon kind={m.kind} />
              <span className="rd-label">{kinds[m.kind]}</span>
            </span>
            <span className="rd-item__title">{subject(m)}</span>
            <span className="rd-note">
              {m.status === 'open'
                ? 'Compra ' + (m.bestBid ?? '—') + ' · Venta ' + (m.bestAsk ?? '—')
                : states[m.status]}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function ContractDetail({ market, board }: { market: Market; board: Board | null }) {
  const spot = board?.teams.find((t) => t.team === market.team);
  const fresh = spot && board && Date.now() - board.at < 120000 && market.status === 'open';
  return (
    <section className="rd-card rd-glass ex-section">
      <div className="ex-section-head">
        <span className="rd-label">
          {kinds[market.kind]} · {states[market.status]}
        </span>
        <a className="ex-link rd-note" href={href(market.id)}>
          Enlace al contrato ↗
        </a>
      </div>
      <h2 className="rd-title ex-contract-title">{subject(market)}</h2>
      <p>{teamText(market.description)}</p>
      <div className="ex-metrics">
        <div>
          <span className="rd-label">Último cruce</span>
          <div className="rd-stat">
            {market.lastPrice ?? '—'}
            <small className="rd-stat__unit">fichas</small>
          </div>
        </div>
        <div>
          <span className="rd-label">Volumen</span>
          <div className="rd-stat">
            {n(market.volume)}
            <small className="rd-stat__unit">contratos</small>
          </div>
        </div>
      </div>
      <Payoff market={market} spot={fresh ? spot.price : undefined} />
      <div className="ex-line-item ex-contract-foot">
        <span className="rd-note">Vence el {when(market.expiry)} · Santiago</span>
        {spot && board && (
          <a className="ex-link rd-note" href={'/terminal?team=' + encodeURIComponent(spot.team)}>
            Platanus · {pct(spot.price)} a las {clock(board.at)} ↗
          </a>
        )}
      </div>
    </section>
  );
}

export function Exchange() {
  const [selected, setSelected] = useState(initialId);
  const [view, setView] = useState<View | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteSeq, setQuoteSeq] = useState(0);
  const [notice, setNotice] = useState<Notice | null>(() => {
    const retry = remembered();
    return retry ? { text: 'Hay una operación pendiente de confirmación.', retry } : null;
  });
  const inFlight = useRef(false);
  const generation = useRef(0);
  const currentTarget = useRef(selected);
  const actionPanel = useRef<HTMLDivElement>(null);
  const token = useRef('');
  const reload = useCallback(async (id: string) => {
    if (inFlight.current) return;
    const rev = ++generation.current;
    try {
      try {
        token.current = localStorage.getItem('mesa26.exchange.wallet.v1') || '';
      } catch {
        /* Public browsing works without a wallet. */
      }
      const response = await fetch(endpoint(id), {
        cache: 'no-store',
        headers: token.current ? { Authorization: 'Bearer ' + token.current } : {},
        signal: AbortSignal.timeout(12000),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo cargar la bolsa.');
      if (generation.current !== rev) return;
      setView(data);
      setError('');
    } catch (err) {
      if (generation.current === rev)
        setError(
          err instanceof Error && !['TypeError', 'SyntaxError', 'TimeoutError'].includes(err.name)
            ? err.message
            : 'No se pudo actualizar la bolsa.',
        );
    }
  }, []);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      await reload(selected);
      if (active) timer = setTimeout(poll, 6000);
    };
    void poll();
    return () => {
      active = false;
      ++generation.current;
      clearTimeout(timer);
    };
  }, [reload, selected]);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const b = await read<Board>('/api/terminal');
        if (active) setBoard(b);
      } catch {
        /* Contracts still trade on the exchange. */
      }
      if (active) timer = setTimeout(poll, 30000);
    }
    void poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  function select(id: string) {
    ++generation.current;
    currentTarget.current = id;
    setSelected(id);
    setCreating(false);
    setQuote(null);
    setError('');
    const url = new URL(location.href);
    if (id) url.searchParams.set('marketId', id);
    else url.searchParams.delete('marketId');
    history.replaceState(null, '', url);
    if (selected === id) void reload(id);
  }
  function showCreate() {
    setCreating(true);
    requestAnimationFrame(() => actionPanel.current?.scrollIntoView({ block: 'start' }));
  }
  async function send(op: Operation) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    ++generation.current;
    setNotice(null);
    try {
      try {
        token.current = getToken();
      } catch {
        throw new Error('Permite el almacenamiento de este sitio para guardar la llave de tu billetera.');
      }
      remember(op);
      const res = await fetch(endpoint(op.target), {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token.current, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...op.command, nonce: op.nonce }),
        signal: AbortSignal.timeout(18000),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status < 500) remember(null);
        setNotice({
          text: data.error || 'No se pudo confirmar la operación.',
          ...(res.status >= 500 && { retry: op }),
        });
        return;
      }
      remember(null);
      const result = data.result;
      if (op.command.type === 'list') {
        select(result.marketId);
        if (data.view.market?.id === result.marketId) setView(data.view);
      } else if (currentTarget.current === op.target) {
        setView(data.view);
        setError('');
      }
      const messages = {
        join: 'Tu billetera está lista.',
        list: 'El mercado está disponible para operar.',
        cancel: 'Orden cancelada.',
        order:
          'Orden recibida. Ejecutados: ' + (result.filled ?? 0) + ' · pendientes: ' + (result.remaining ?? 0) + '.',
      };
      setNotice({ text: messages[op.command.type] });
    } catch (err) {
      if (remembered()?.nonce === op.nonce)
        setNotice({ text: 'Aún no se confirma la operación. Puedes consultar el mismo envío.', retry: op });
      else setNotice({ text: err instanceof Error ? err.message : 'No se pudo enviar la operación.' });
    } finally {
      inFlight.current = false;
      setBusy(false);
      void reload(currentTarget.current);
    }
  }
  function run(command: Command) {
    const old = remembered();
    if (old && JSON.stringify(old.command) === JSON.stringify(command)) {
      void send(old);
      return;
    }
    void send({ command, nonce: crypto.randomUUID(), target: currentTarget.current });
  }
  const market = view?.market && (!selected || selected === view.market.id) ? view.market : null;
  const wallet = view?.wallet ?? null;
  const markets = view?.markets ?? [];
  const open = markets.filter((m) => m.status === 'open').length;
  return (
    <div className="exchange">
      <header className="ex-hero">
        <div>
          <h1 className="rd-hero">Bolsa de contratos</h1>
          <p>Opera con fichas de juego sobre los precios de los equipos de Platanus.</p>
        </div>
        <button type="button" className="rd-button rd-button--quiet ex-create" onClick={showCreate}>
          ＋ Crear mercado
        </button>
      </header>
      {error && (
        <div className="rd-glass ex-alert" role="status">
          <span>{error}</span>
          <button
            type="button"
            className="rd-button rd-button--small rd-button--quiet"
            onClick={() => (selected && !market ? select('') : void reload(selected))}
          >
            {selected && !market ? 'Ver mercados' : 'Actualizar'}
          </button>
        </div>
      )}
      {markets.length > 0 && <MarketDirectory markets={markets} active={market?.id ?? selected} select={select} />}
      <div className="ex-layout">
        <div className="ex-contract">
          {market ? (
            <ContractDetail market={market} board={board} />
          ) : (
            <section className="rd-card rd-glass ex-section">
              <h2 className="rd-title">{!view || selected ? 'Cargando el mercado…' : 'La bolsa está abierta'}</h2>
              <p className="rd-note">
                {view && !selected && !markets.length
                  ? 'Crea el primer contrato para recibir ofertas de otros jugadores.'
                  : 'Consultando el libro de órdenes.'}
              </p>
            </section>
          )}
        </div>
        <div className="ex-trade" ref={actionPanel}>
          {creating ? (
            <ListForm board={board} joined={!!wallet} busy={busy} run={run} close={() => setCreating(false)} />
          ) : market ? (
            <OrderForm
              key={market.id + ':' + quoteSeq}
              market={market}
              wallet={wallet}
              busy={busy}
              quote={quote}
              run={run}
            />
          ) : (
            !wallet &&
            view && (
              <section className="rd-decision">
                <div className="rd-decision__body">
                  <h2 className="rd-title">Tu primera billetera</h2>
                  <p>Recibe 1.000 fichas de juego en este navegador.</p>
                  <button className="rd-button" disabled={busy} onClick={() => run({ type: 'join' })}>
                    Abrir mi billetera
                  </button>
                </div>
              </section>
            )
          )}
        </div>
        <div className="ex-market-bottom rd-stack">
          {view && market && (
            <>
              <Resolution market={market} />
              <MarketActivity
                view={view}
                quote={(q) => {
                  setQuote(q);
                  setQuoteSeq((v) => v + 1);
                  setCreating(false);
                  requestAnimationFrame(() => actionPanel.current?.scrollIntoView({ block: 'start' }));
                }}
              />
            </>
          )}
        </div>
        <div className="ex-account rd-stack">
          {wallet && <WalletPanel wallet={wallet} markets={markets} select={select} run={run} busy={busy} />}
        </div>
      </div>
      {view && (
        <p className="ex-footer rd-note">
          {n(open)} mercados abiertos · Fichas de práctica sin valor monetario ·{' '}
          <a href="/agent.md">API para agentes ↗</a>
        </p>
      )}
      {notice && (
        <div role="status" className="ex-notice rd-glass">
          <span>{notice.text}</span>
          {notice.retry && (
            <button
              className="rd-button rd-button--small rd-button--quiet"
              disabled={busy}
              onClick={() => void send(notice.retry!)}
            >
              Confirmar envío
            </button>
          )}
          <button type="button" className="rd-iconbutton" aria-label="Cerrar aviso" onClick={() => setNotice(null)}>
            ×
          </button>
        </div>
      )}
    </div>
  );
}
