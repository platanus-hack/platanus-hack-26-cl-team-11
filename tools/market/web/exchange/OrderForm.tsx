import { useState } from 'react';
import type { FormEvent } from 'react';
import { n, states, type Market, type Side, type Wallet, type Run, type Level } from './types';

export type Quote = Level & { side: Side };
export function OrderForm({
  market,
  wallet,
  busy,
  quote,
  run,
}: {
  market: Market;
  wallet: Wallet | null;
  busy: boolean;
  quote: Quote | null;
  run: Run;
}) {
  const [side, setSide] = useState<Side>(quote?.side ?? 'buy');
  const best = side === 'buy' ? market.bestAsk : market.bestBid;
  const [limit, setLimit] = useState<string | null>(quote ? String(quote.price) : null);
  const [amount, setAmount] = useState('1');
  const price = limit ?? String(Math.max(1, Math.min(99, best ?? market.lastPrice ?? 50)));
  const qty = Number(amount);
  const opposite = wallet?.positions.find(
    (p) => p.marketId === market.id && p.side === (side === 'buy' ? 'short' : 'long'),
  );
  const canClose = opposite ? opposite.qty - opposite.pledged : 0;
  const margin = Math.max(0, qty - canClose) * (side === 'buy' ? Number(price) : 100 - Number(price));
  const closed = market.status !== 'open' || market.expiry <= Date.now();
  const yesNo = ['binary', 'range', 'manual'].includes(market.kind);
  const valid =
    Number.isInteger(qty) &&
    qty >= 1 &&
    qty <= 1000 &&
    Number.isInteger(Number(price)) &&
    Number(price) >= 1 &&
    Number(price) <= 99;
  const insufficient = valid && wallet && margin > wallet.available;
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!wallet) return run({ type: 'join' });
    if (!valid || closed || insufficient) return;
    run({ type: 'order', marketId: market.id, side, price: Number(price), qty });
  }
  if (closed)
    return (
      <section className="rd-card rd-glass">
        <span className="rd-label">{states[market.status]}</span>
        <h2 className="rd-title">El mercado cerró</h2>
        <p className="rd-note">
          {market.status === 'open' || market.status === 'pending'
            ? (market.kind === 'manual' ? 'Esperando la resolución de Mati.' : 'Esperando los precios oficiales al vencimiento.')
            : 'Revisa el detalle de liquidación de este contrato.'}
        </p>
      </section>
    );
  return (
    <section className="rd-decision" id="orden">
      <form onSubmit={submit} className="rd-decision__body ex-form">
        <span className="rd-decision__label rd-gradient-text">Orden limitada</span>
        <h2 className="rd-title">Operar este contrato</h2>
        <div className="ex-switch" aria-label="Lado de la orden" role="group">
          {(['buy', 'sell'] as const).map((s) => (
            <button
              key={s}
              type="button"
              className="rd-button rd-button--quiet"
              aria-pressed={side === s}
              onClick={() => {
                setSide(s);
                setLimit(null);
              }}
            >
              {s === 'buy' ? 'Comprar' : 'Vender'}{yesNo && ' Sí'}
            </button>
          ))}
        </div>
        <div className="ex-pair">
          <label className="ex-field">
            <span className="rd-label">{yesNo ? 'Precio límite del Sí' : 'Precio límite'}</span>
            <input
              className="rd-input"
              type="number"
              min="1"
              max="99"
              step="1"
              required
              value={price}
              onChange={(e) => setLimit(e.target.value)}
            />
          </label>
          <label className="ex-field">
            <span className="rd-label">Cantidad</span>
            <input
              className="rd-input"
              type="number"
              min="1"
              max="1000"
              step="1"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
        </div>
        <p className="rd-note">
          {side === 'buy'
            ? yesNo
              ? 'Compras Sí a este precio o menos. Primero cierras tus posiciones cortas. Cada Sí que conserves paga 100 fichas si se cumple la condición.'
              : 'Compras a este precio o menos. Al vencimiento recibes el pago del contrato.'
            : yesNo
              ? 'Vendes Sí a este precio o más. Primero cierras tus posiciones de Sí. Por cada venta adicional abres un corto que paga 100 fichas si el resultado es No.'
              : 'Vendes a este precio o más. Al vencimiento recibes 100 fichas menos el pago al comprador.'}
        </p>
        <div className="ex-line-item">
          <span>Reserva máxima</span>
          <span className="rd-item__value">{valid ? n(margin) : '—'} fichas</span>
        </div>
        {wallet ? (
          <>
            <p className="rd-note">
              {insufficient
                ? 'Saldo insuficiente. Baja la cantidad o cancela una orden abierta.'
                : n(wallet.available) + ' fichas disponibles en tu billetera.'}
            </p>
            <button className="rd-button" disabled={busy || !valid || !!insufficient}>
              {busy ? 'Enviando…' : side === 'buy' ? 'Enviar compra' : 'Enviar venta'}
            </button>
          </>
        ) : (
          <>
            <p className="rd-note">Recibe 1.000 fichas de juego para empezar. Tu billetera queda en este navegador.</p>
            <button className="rd-button" type="button" disabled={busy} onClick={() => run({ type: 'join' })}>
              {busy ? 'Abriendo…' : 'Abrir mi billetera'}
            </button>
          </>
        )}
      </form>
    </section>
  );
}
