import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Board } from '../market';
import { publicKinds, teamName, when, type PublicKind, type Run, type Spec } from './types';

const rules: Record<PublicKind, string> = {
  binary: 'Paga 100 fichas si el equipo llega al objetivo o lo supera. Debajo paga 0.',
  call: 'Sobre el objetivo, el pago sube de 0 a 100 fichas a lo largo del tramo elegido.',
  put: 'Debajo del objetivo, el pago sube de 0 a 100 fichas a lo largo del tramo elegido.',
  linear: 'Paga una ficha por cada punto porcentual del precio final, redondeado al entero más cercano.',
  straddle:
    'En el objetivo paga 0. El pago aumenta en ambas direcciones hasta 100 fichas al recorrer el tramo elegido.',
  future: 'En el objetivo paga 50 fichas. Un tramo por debajo paga 0 y un tramo por encima paga 100.',
  range: 'Paga 100 fichas si el precio termina entre los dos límites, incluidos ambos. Fuera paga 0.',
  race: 'El equipo que más sube en porcentaje desde la creación gana. El comprador recibe 100 fichas si gana su equipo, 50 si empatan y 0 si pierde.',
  butterfly: 'En el objetivo paga 100 fichas. El pago baja hacia ambos lados y llega a 0 a un tramo del objetivo.',
};
const eventEnd = Date.UTC(2026, 10, 22, 19);
const durations = [
  [5, '5 minutos'],
  [15, '15 minutos'],
  [60, '1 hora'],
  [240, '4 horas'],
  [1440, '24 horas'],
] as const;
const expiration = (minutes: number, now: number) =>
  Math.min(eventEnd, Math.floor((now + minutes * 60000) / 60000) * 60000);

export function ListForm({
  board,
  joined,
  busy,
  run,
  close,
}: {
  board: Board | null;
  joined: boolean;
  busy: boolean;
  run: Run;
  close: () => void;
}) {
  const teams = board?.teams ?? [];
  const [kind, setKind] = useState<PublicKind>('binary');
  const [selection, setSelection] = useState('');
  const [rival, setRival] = useState('');
  const [strike, setStrike] = useState<string | null>(null);
  const [width, setWidth] = useState('1');
  const [upper, setUpper] = useState<string | null>(null);
  const [duration, setDuration] = useState(60);
  const team = teams.find((t) => t.team === selection) ?? teams[0];
  const rivals = teams.filter((t) => t.team !== team?.team);
  const second = rivals.find((t) => t.team === rival) ?? rivals[0];
  const suggestedStrike = team ? (Math.round(team.price * 10000) / 100).toString() : '';
  const strikeValue = strike ?? suggestedStrike;
  const suggestedUpper = Math.min(100, Number(strikeValue) + 1).toFixed(2);
  const upperValue = upper ?? suggestedUpper;
  const hasWidth = ['call', 'put', 'future', 'butterfly', 'straddle'].includes(kind);
  const until = expiration(duration, Date.now());
  const [error, setError] = useState('');
  const unavailable = until - Date.now() < 30000;
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!joined) return run({ type: 'join' });
    if (!team) return;
    const spec: Spec = { team: team.team, kind, expiry: expiration(duration, Date.now()) };
    if (kind === 'race') {
      if (!second) return;
      spec.rival = second.team;
    } else if (kind !== 'linear') {
      spec.strike = Math.round(Number(strikeValue) * 100);
      if (hasWidth) spec.width = Math.round(Number(width) * 100);
      if (kind === 'range') {
        spec.upper = Math.round(Number(upperValue) * 100);
        if (spec.upper <= spec.strike) return setError('El límite superior debe superar al inferior.');
      }
    }
    setError('');
    run({ type: 'list', spec });
  }
  return (
    <section className="rd-decision" id="crear-contrato">
      <form className="rd-decision__body ex-form" onSubmit={submit}>
        <div className="rd-head">
          <h2 className="rd-title">Crear un mercado</h2>
          <button className="rd-button rd-button--quiet rd-button--small rd-head__end" type="button" onClick={close}>
            Volver
          </button>
        </div>
        <label className="ex-field">
          <span className="rd-label">Tipo de contrato</span>
          <select
            className="rd-input"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as PublicKind);
              setError('');
            }}
          >
            {Object.entries(publicKinds).map(([key, name]) => (
              <option key={key} value={key}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <p className="rd-note">{rules[kind]}</p>
        <label className="ex-field">
          <span className="rd-label">Equipo</span>
          <select
            className="rd-input"
            value={team?.team || ''}
            onChange={(e) => {
              setSelection(e.target.value);
              setStrike(null);
              setUpper(null);
            }}
          >
            {!team && <option value="">Esperando la lista de Platanus…</option>}
            {teams.map((t) => (
              <option key={t.id} value={t.team}>
                {teamName(t)}
              </option>
            ))}
          </select>
        </label>
        {kind === 'race' ? (
          <label className="ex-field">
            <span className="rd-label">Equipo rival</span>
            <select className="rd-input" value={second?.team || ''} onChange={(e) => setRival(e.target.value)}>
              {rivals.map((t) => (
                <option key={t.id} value={t.team}>
                  {teamName(t)}
                </option>
              ))}
            </select>
          </label>
        ) : (
          kind !== 'linear' && (
            <div className="ex-pair">
              <label className="ex-field">
                <span className="rd-label">{kind === 'range' ? 'Límite inferior (%)' : 'Objetivo (%)'}</span>
                <input
                  className="rd-input"
                  type="number"
                  min="0"
                  max="100"
                  step=".01"
                  required
                  value={strikeValue}
                  onChange={(e) => setStrike(e.target.value)}
                />
              </label>
              {hasWidth && (
                <label className="ex-field">
                  <span className="rd-label">Tramo (puntos %)</span>
                  <input
                    className="rd-input"
                    type="number"
                    min=".01"
                    max="100"
                    step=".01"
                    required
                    value={width}
                    onChange={(e) => setWidth(e.target.value)}
                  />
                </label>
              )}
              {kind === 'range' && (
                <label className="ex-field">
                  <span className="rd-label">Límite superior (%)</span>
                  <input
                    className="rd-input"
                    type="number"
                    min="0"
                    max="100"
                    step=".01"
                    required
                    value={upperValue}
                    onChange={(e) => setUpper(e.target.value)}
                  />
                </label>
              )}
            </div>
          )
        )}
        <label className="ex-field">
          <span className="rd-label">Vencimiento</span>
          <select className="rd-input" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
            {durations.map(([minutes, label]) => (
              <option key={minutes} value={minutes}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <p className="rd-note">
          {unavailable
            ? 'Terminó la ventana para listar contratos del Hack 26.'
            : 'Cierra el ' + when(until) + ' (Santiago).'}
        </p>
        {error && <p role="alert">{error}</p>}
        {!joined && (
          <p className="rd-note">Abre tu billetera con 1.000 fichas de práctica para publicar este contrato.</p>
        )}
        {!joined ? (
          <button className="rd-button" type="button" disabled={busy} onClick={() => run({ type: 'join' })}>
            Abrir mi billetera
          </button>
        ) : (
          <button
            className="rd-button"
            type="submit"
            disabled={busy || !team || unavailable || (kind === 'race' && !second)}
          >
            {busy ? 'Publicando…' : 'Publicar mercado'}
          </button>
        )}
      </form>
    </section>
  );
}
