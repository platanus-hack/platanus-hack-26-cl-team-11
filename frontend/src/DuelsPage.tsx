import { useCallback, useEffect, useRef, useState } from 'react';
import { request } from './api';
import { usePolling } from './usePolling';
import './duels.css';

type Team = { id: string; name: string; price: number };
type Order = {
  id: string;
  a: string;
  b: string;
  maker: string;
  taker: string | null;
  mine: string;
  state: string;
  due: number;
  startA: number;
  startB: number;
  endA: number | null;
  endB: number | null;
  verdict: string | null;
};
type Lobby = {
  wallet: { name: string; points: number } | null;
  orders: Order[];
  feed: { available: boolean; ts: number | null; teams: Team[] };
};
const base = '/api/duelos';
const key = 'ronda-duelos-wallet-v1';
function favicon() {
  const theme = getComputedStyle(document.documentElement);
  const ink = theme.getPropertyValue('--rd-ink').trim();
  const paper = theme.getPropertyValue('--rd-glass-solid').trim();
  return (
    'data:image/svg+xml,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="12" fill="${ink}"/><path d="M8 28l9-9-4-4 12-5m-7 0h8v8" fill="none" stroke="${paper}" stroke-width="4" stroke-linejoin="round"/><path d="M22 28h10" stroke="${paper}" stroke-width="3"/></svg>`,
    )
  );
}
const formatPct = (v: number) => (v * 100).toLocaleString('es-CL', { maximumFractionDigits: 2, minimumFractionDigits: 2 }) + '%';
const timeOf = (ts: number) =>
  new Date(ts).toLocaleTimeString('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'America/Santiago',
  });
const teamLabel = (p: Team) =>
  p.name === p.id ? 'Equipo ' + p.id.replace('team-', '') : p.name + ' · ' + p.id.replace('team-', '');
function token(create = false): string {
  let value = localStorage.getItem(key) || '';
  if (!value && create) {
    value = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(key, value);
  }
  return value;
}
function headers(create = false): Record<string, string> {
  const wallet = token(create);
  return wallet
    ? { Authorization: 'Bearer ' + wallet, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

export function DuelsPage() {
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [a, setA] = useState(''),
    [b, setB] = useState('');
  const [name, setName] = useState(''),
    [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(''),
    [share, setShare] = useState('');
  const [now, setNow] = useState(Date.now());
  const nonce = useRef('');
  const seq = useRef(0);
  const locked = useRef(false);
  const focus = new URLSearchParams(location.search).get('duelo') || '';
  const load = useCallback(async () => {
    const revision = ++seq.current;
    const data = await request<Lobby>(base + '?duelo=' + encodeURIComponent(focus), { headers: headers(), cache: 'no-store' });
    if (seq.current !== revision) return;
    setLobby(data);
    const ranked = [...data.feed.teams].sort((x, y) => y.price - x.price);
    const [leader, runnerUp] = ranked;
    if (leader && runnerUp) {
      setA((previous) => previous || leader.id);
      setB((previous) => previous || runnerUp.id);
    }
  }, [focus]);
  const { error, refresh } = usePolling(load, 6000);
  useEffect(() => {
    document.title = 'Duelo de equipos · Ronda';
    const fav = document.createElement('link');
    fav.rel = 'icon';
    fav.href = favicon();
    document.head.append(fav);
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(timer);
      fav.remove();
    };
  }, []);
  const teams = [...(lobby?.feed.teams ?? [])].sort((x, y) => y.price - x.price);
  const first = teams.find((p) => p.id === a) ?? teams[0];
  const second = teams.find((p) => p.id === b && p.id !== first?.id) ?? teams.find((p) => p.id !== first?.id);
  const wallet = lobby?.wallet;
  const fresh = !!lobby?.feed.available && !!lobby.feed.ts && now - lobby.feed.ts < 25000;
  const label = (id: string) => {
    const p = teams.find((x) => x.id === id);
    return p ? teamLabel(p) : id;
  };
  async function action(kind: string, body: object) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setNotice('');
    try {
      await request(base + '/' + kind, { method: 'POST', headers: headers(kind === 'join'), body: JSON.stringify(body) });
      nonce.current = '';
      setNotice(
        (
          {
            join: 'Tu monedero está listo.',
            place: 'Oferta publicada. Puedes compartirla con un rival.',
            accept: 'Duelo aceptado. Ya corre el reloj.',
            cancel: 'Oferta retirada. Recuperaste tus 10 fichas.',
          } as Record<string, string>
        )[kind] || '',
      );
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'No se pudo completar la orden.');
    } finally {
      await refresh();
      locked.current = false;
      setBusy(false);
    }
  }
  async function invite(id: string) {
    const url = new URL('/duelos', location.origin);
    if (id) url.searchParams.set('duelo', id);
    try {
      await navigator.clipboard.writeText(url.href);
      setShare('');
      setNotice('Enlace copiado.');
    } catch {
      setShare(url.href);
    }
  }
  function sidePicker(side: 'a' | 'b', team: Team | undefined) {
    const home = side === 'a';
    return (
      <div className="rd-card rd-glass duel-side">
        <label className="rd-label" htmlFor={'pick-' + side}>
          {home ? 'Tu equipo' : 'Equipo rival'}
        </label>
        <select
          className="rd-input"
          id={'pick-' + side}
          value={team?.id || ''}
          disabled={!teams.length}
          onChange={(e) => {
            nonce.current = '';
            if (home) {
              if (e.target.value === second?.id) setB(first?.id || '');
              setA(e.target.value);
            } else setB(e.target.value);
          }}
        >
          {teams
            .filter((p) => home || p.id !== first?.id)
            .map((p) => (
              <option value={p.id} key={p.id}>
                {teamLabel(p)}
              </option>
            ))}
        </select>
        <span className="rd-stat">{team ? formatPct(team.price) : '—'}</span>
        <span className="rd-note">Precio de mercado</span>
      </div>
    );
  }
  function card(o: Order) {
    const clock = Math.max(0, Math.ceil((o.due - now) / 1000));
    const time = Math.floor(clock / 60) + ' min ' + String(clock % 60).padStart(2, '0') + ' s';
    const verdict: Record<string, string> = {
      a: 'Gana ' + o.maker,
      b: 'Gana ' + o.taker,
      tie: 'Empate · fichas devueltas',
      void: 'Vencido · fichas devueltas',
      cancelled: 'Oferta retirada',
    };
    const state = o.state === 'open' ? 'Busca rival' : o.state === 'live' ? 'En juego' : verdict[o.verdict || ''];
    const moves = (x: number, y: number) => (x >= y ? '+' : '') + formatPct(x / y - 1);
    const liveA = teams.find((p) => p.id === o.a),
      liveB = teams.find((p) => p.id === o.b);
    const movement =
      liveA && liveB && o.state === 'live' && fresh
        ? [
            { team: o.a, change: liveA.price / o.startA - 1 },
            { team: o.b, change: liveB.price / o.startB - 1 },
          ]
        : null;
    return (
      <article className="rd-card rd-glass duel-order" key={o.id}>
        <span className="rd-label">
          {state} {o.state === 'live' ? '· ' + time : ''}
        </span>
        <strong className="rd-title">
          {label(o.a)} vs. {label(o.b)}
        </strong>
        <span className="rd-note">
          {o.maker} {o.taker ? 'y ' + o.taker : 'ofrece 10 fichas'}
          {o.mine ? ' · Tu equipo es ' + label(o.mine === 'a' ? o.a : o.b) : ''}
        </span>
        {o.state === 'open' && (
          <span className="rd-note">
            Quien acepte juega con {label(o.b)}. Vence a las {timeOf(o.due)}.
          </span>
        )}
        {movement && (
          <div className="duel-score">
            {movement.map((s) => (
              <div key={s.team}>
                <span className="rd-label">{label(s.team)}</span>
                <div className="rd-stat">
                  {s.change >= 0 ? '+' : ''}
                  {formatPct(s.change)}
                </div>
              </div>
            ))}
          </div>
        )}
        {o.endA !== null && o.endB !== null && (
          <span className="rd-note">
            Variación final · {moves(o.endA, o.startA)} / {moves(o.endB, o.startB)}
          </span>
        )}
        {o.state === 'open' && (
          <div className="rd-actions">
            {o.mine === 'a' ? (
              <button className="rd-button rd-button--quiet" disabled={busy} onClick={() => void action('cancel', { id: o.id })}>
                Retirar
              </button>
            ) : (
              <button
                className="rd-button rd-button--quiet"
                disabled={!wallet || wallet.points < 10 || busy || !fresh || clock === 0}
                onClick={() => void action('accept', { id: o.id })}
              >
                Aceptar por 10 fichas
              </button>
            )}
            <button className="rd-button rd-button--quiet" onClick={() => void invite(o.id)}>
              Copiar enlace
            </button>
          </div>
        )}
      </article>
    );
  }
  const orders = lobby?.orders ?? [];
  const invited = orders.find((o) => o.id === focus);
  const own = orders.filter((o) => o.mine && o !== invited);
  const offers = orders.filter((o) => !o.mine && o.state === 'open' && o !== invited);
  return (
    <div className="duels">
      <header className="duel-heading">
        <h1 className="rd-hero">Duelo de equipos</h1>
        <p className="rd-note">
          Elige qué equipo subirá más en cinco minutos. Cada jugador pone 10 fichas y quien acierta se lleva las 20.
        </p>
      </header>
      {invited && (
        <section className="rd-stack">
          <h2 className="rd-title">Duelo compartido</h2>
          {card(invited)}
        </section>
      )}
      <div className="duel-grid">
        <section className="rd-stack">
          <h2 className="rd-title">Arma tu duelo</h2>
          <div className="duel-pair">
            {sidePicker('a', first)}
            {sidePicker('b', second)}
          </div>
          <span className="rd-note">
            {fresh
              ? 'Precios de Platanus · ' + timeOf(lobby!.feed.ts!)
              : lobby
                ? 'Precios en pausa. Las ofertas se habilitan con la próxima lectura.'
                : 'Cargando precios de Platanus…'}
          </span>
        </section>
        <section className="rd-decision">
          <div className="rd-decision__body">
            <span className="rd-decision__label rd-gradient-text">
              {wallet ? 'Monedero de ' + wallet.name : 'Tu monedero de juego'}
            </span>
            <div className="rd-stat">
              {wallet?.points ?? 100}
              <span className="rd-stat__unit"> fichas{wallet ? ' libres' : ' iniciales'}</span>
            </div>
            <p className="rd-note">Estas fichas sirven solo para los duelos. El monedero se guarda en este navegador.</p>
            {wallet ? (
              <button
                className="rd-button"
                disabled={busy || !fresh || !first || !second || wallet.points < 10}
                onClick={() => {
                  nonce.current ||= crypto.randomUUID();
                  void action('place', { nonce: nonce.current, a: first?.id, b: second?.id });
                }}
              >
                Publicar oferta por 10 fichas
              </button>
            ) : (
              <form
                className="app-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void action('join', { name: name.trim() });
                }}
              >
                <label className="rd-label" htmlFor="alias">
                  Tu alias público
                </label>
                <input
                  id="alias"
                  className="rd-input"
                  maxLength={24}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="¿Cómo te llamas?"
                  required
                />
                <button className="rd-button" disabled={!name.trim() || busy || !lobby}>
                  Entrar a jugar
                </button>
              </form>
            )}
          </div>
        </section>
      </div>
      <div role="status" aria-live="polite">
        {(error || notice) && <p>{error || notice}</p>}
        {share && (
          <input
            aria-label="Enlace para compartir"
            className="rd-input"
            readOnly
            value={share}
            onFocus={(e) => e.target.select()}
          />
        )}
      </div>
      <div className="duel-grid">
        <section className="rd-stack">
          <h2 className="rd-title">Ofertas abiertas</h2>
          {offers.length ? (
            offers.map(card)
          ) : (
            <p className="rd-note">Aún no hay ofertas de otros jugadores. Publica la tuya y comparte el enlace.</p>
          )}
        </section>
        <section className="rd-stack">
          <h2 className="rd-title">Tus duelos</h2>
          {own.length ? own.map(card) : <p className="rd-note">Aquí verás tus ofertas y resultados.</p>}
        </section>
      </div>
      <details>
        <summary>Cómo se decide el resultado</summary>
        <p className="rd-note">
          El reloj parte cuando alguien acepta. Comparamos el cambio porcentual de ambos precios. Si los dos caen, gana el que cae
          menos. Si empatan, el mercado cierra o falta un precio durante los 45 segundos posteriores al vencimiento, cada jugador
          recupera sus 10 fichas. Las ofertas sin rival vencen a los diez minutos.
        </p>
      </details>
    </div>
  );
}
