import { useState } from 'react';
import { clock, pct } from '../market';
import { bps, n, teamText, when, type Market, type Run, type View, type Wallet } from './types';
import type { Quote } from './OrderForm';

export function MarketActivity({ view, quote }: { view: View; quote: (q: Quote) => void }) {
  const { book, fills, market } = view;
  const open = market?.status === 'open' && market.expiry > Date.now();
  return (
    <section className="rd-card rd-glass ex-section">
      <h2 className="rd-title">Libro de órdenes</h2>
      <div className="ex-pair ex-book">
        {(['bids', 'asks'] as const).map((side) => (
          <div key={side}>
            <h3 className="rd-label">{side === 'bids' ? 'Compradores' : 'Vendedores'}</h3>
            {!!book[side].length && (
              <div className="ex-book-row rd-note">
                <span>Precio</span>
                <span>Cantidad</span>
              </div>
            )}
            <div className="ex-depth">
              {book[side].map((level) => (
                <button
                  type="button"
                  className="ex-book-row app-pick"
                  key={level.price}
                  disabled={!open || level.price < 1 || level.price > 99}
                  aria-label={(side === 'bids' ? 'Vender' : 'Comprar') + ' a ' + level.price + ' fichas'}
                  onClick={() => quote({ ...level, side: side === 'bids' ? 'sell' : 'buy' })}
                >
                  <span className="rd-item__value">{level.price}</span>
                  <span>{n(level.qty)}</span>
                </button>
              ))}
            </div>
            {!book[side].length && <p className="rd-note">{side === 'bids' ? 'Sin compras.' : 'Sin ventas.'}</p>}
          </div>
        ))}
      </div>
      <details className="ex-details">
        <summary>
          Últimos cruces <span className="rd-note">({fills.length})</span>
        </summary>
        {fills.length ? (
          <div className="ex-history">
            {fills.map((f) => (
              <div className="ex-line-item" key={f.id}>
                <span>
                  {n(f.qty)} × {f.price} fichas
                </span>
                <span className="rd-note">{clock(f.at)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="rd-note">Aún no se han cruzado órdenes en este mercado.</p>
        )}
      </details>
    </section>
  );
}

export function Resolution({ market }: { market: Market }) {
  if (market.status === 'open') return null;
  const evidence = market.evidence;
  return (
    <section className="rd-card rd-glass ex-section">
      <h2 className="rd-title">Liquidación</h2>
      {market.status === 'pending' ? (
        <p>El contrato venció. Estamos esperando una cotización oficial que cubra el cierre.</p>
      ) : market.status === 'voided' ? (
        <p>Mercado anulado. Se devolvieron los aportes de las posiciones.</p>
      ) : (
        <div className="ex-pair">
          {[
            ['Comprador', market.payout!],
            ['Vendedor', 100 - market.payout!],
          ].map(([text, value]) => (
            <div key={text}>
              <div className="rd-label">{text}</div>
              <div className="rd-stat">
                {value}
                <small className="rd-stat__unit">fichas</small>
              </div>
            </div>
          ))}
        </div>
      )}
      {evidence?.observations?.map((o) => (
        <div className="ex-line-item" key={o.team}>
          <div>
            <a
              className="ex-link"
              href={'https://hack.platan.us/api/market/history/' + encodeURIComponent(o.id) + '?event=26-cl'}
              target="_blank"
              rel="noreferrer"
            >
              {teamText(o.team)} ↗
            </a>
            <p className="rd-note">
              Último precio a las {clock(o.at)} · historial cubierto hasta {clock(o.coveredThrough)}
              {o.baseline != null && ' · inició en ' + bps(o.baseline)}
            </p>
          </div>
          <span className="rd-item__value">{pct(o.price)}</span>
        </div>
      ))}
      {evidence?.reason && <p className="rd-note">{evidence.reason}</p>}
      <p className="rd-note">
        Vencimiento el {when(market.expiry)} en Santiago. Se usa el último precio oficial a esa hora o antes.
      </p>
    </section>
  );
}

type WalletTab = 'orders' | 'positions' | 'fills' | 'settlements';
const tabs = { orders: 'Órdenes', positions: 'Posiciones', fills: 'Cruces', settlements: 'Pagos' } as const;
export function WalletPanel({
  wallet,
  markets,
  select,
  run,
  busy,
}: {
  wallet: Wallet;
  markets: Market[];
  select: (id: string) => void;
  run: Run;
  busy: boolean;
}) {
  const [tab, setTab] = useState<WalletTab>('orders');
  function marketLink(id: string) {
    const market = markets.find((m) => m.id === id);
    return (
      <button className="ex-link" type="button" onClick={() => select(id)}>
        {market ? teamText(market.title) : id}
      </button>
    );
  }
  return (
    <section className="rd-card rd-glass ex-section" id="billetera">
      <h2 className="rd-title">Tu billetera</h2>
      {Number.isFinite(wallet.markedEquity) && (
        <div className="ex-line-item">
          <div>
            <div className="rd-label">Valor estimado</div>
            <div className="rd-stat">
              {n(wallet.markedEquity)}
              <small className="rd-stat__unit">fichas</small>
            </div>
          </div>
          <span className="rd-note">
            {wallet.markedPnl >= 0 ? '+' : ''}
            {n(wallet.markedPnl)} desde el inicio
          </span>
        </div>
      )}
      <div className="ex-wallet-summary">
        {[
          ['Disponibles', wallet.available],
          ['En órdenes', wallet.locked],
          ['En posiciones', wallet.collateral],
        ].map(([text, value]) => (
          <div key={text}>
            <span className="rd-label">{text}</span>
            <div className="rd-item__value">{n(Number(value))}</div>
          </div>
        ))}
      </div>
      <p className="rd-note">Patrimonio al costo de entrada · {n(wallet.equityAtCost)} fichas.</p>
      {(wallet.settlementCredit > 0 || wallet.voidCredit > 0) && (
        <p className="rd-note">
          Por posiciones cerradas quedan {n(wallet.settlementCredit)} fichas por cobrar si se liquida y{' '}
          {n(wallet.voidCredit)} si se anula.
        </p>
      )}
      <div className="ex-wallet-tabs" role="group" aria-label="Actividad de tu billetera">
        {(Object.keys(tabs) as WalletTab[]).map((key) => (
          <button
            type="button"
            key={key}
            className="rd-button rd-button--quiet rd-button--small"
            aria-pressed={tab === key}
            onClick={() => setTab(key)}
          >
            {tabs[key]} · {wallet[key].length}
          </button>
        ))}
      </div>
      <div className="ex-history">
        {tab === 'orders' &&
          wallet.orders.map((o) => (
            <div className="ex-line-item" key={o.id}>
              <div>
                {marketLink(o.marketId)}
                <p className="rd-note">
                  {o.side === 'buy' ? 'Compra' : 'Venta'} · {n(o.remaining)} de {n(o.qty)} a {o.price} fichas
                </p>
              </div>
              <button
                type="button"
                className="rd-button rd-button--quiet rd-button--small"
                disabled={busy}
                onClick={() => run({ type: 'cancel', orderId: o.id })}
              >
                Cancelar
              </button>
            </div>
          ))}
        {tab === 'positions' &&
          wallet.positions.map((p) => (
            <div className="ex-line-item" key={p.marketId + p.side}>
              <div>
                {marketLink(p.marketId)}
                <p className="rd-note">
                  {p.side === 'long' ? 'Compradora' : 'Vendedora'} · {n(p.qty)} contratos
                  {p.pledged ? ' · ' + n(p.pledged) + ' reservados en órdenes' : ''}
                </p>
              </div>
              <span className="rd-item__value">
                {n(p.value ?? p.collateral)} fichas
                {Number.isFinite(p.unrealizedPnl) && (
                  <small className="rd-note ex-pnl">
                    {p.unrealizedPnl >= 0 ? '+' : ''}
                    {n(p.unrealizedPnl)} al precio actual
                  </small>
                )}
              </span>
            </div>
          ))}
        {tab === 'fills' &&
          wallet.fills.map((f) => (
            <div className="ex-line-item" key={f.id}>
              <div>
                {marketLink(f.marketId)}
                <p className="rd-note">
                  {f.side === 'buy' ? 'Compra' : 'Venta'} · {n(f.qty)} × {f.price} fichas
                </p>
              </div>
              <span className="rd-note">{clock(f.at)}</span>
            </div>
          ))}
        {tab === 'settlements' &&
          wallet.settlements.map((s) => (
            <div className="ex-line-item" key={s.marketId}>
              <div>
                {marketLink(s.marketId)}
                <p className="rd-note">
                  {s.payout === null ? 'Devolución' : 'Liquidación'} · {when(s.at)}
                </p>
              </div>
              <span className="rd-item__value">{n(s.amount)} fichas</span>
            </div>
          ))}
        {!wallet[tab].length && (
          <p className="rd-note">
            {
              {
                orders: 'No tienes órdenes abiertas.',
                positions: 'Tus posiciones aparecen cuando se cruza una orden.',
                fills: 'Aún no se han cruzado tus órdenes.',
                settlements: 'Aquí aparecerán los pagos al vencimiento.',
              }[tab]
            }
          </p>
        )}
      </div>
    </section>
  );
}
