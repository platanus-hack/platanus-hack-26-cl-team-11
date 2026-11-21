import { useEffect, useState } from 'react';
import { clock, move, pct, read, save, saved, teamLabel } from './market';
type Choice = { team: string; before: number; after: number; price: number };
type Round = { at: number; winner: string; impulse: string; favorite: string; choices: Choice[] };
export function Arena() {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [failure, setFailure] = useState(false);
  const [index, setIndex] = useState(0);
  const [picks, setPicks] = useState<Record<string, string>>(() => saved('archive-picks', {}));
  useEffect(() => {
    read<Round[]>('/rounds.json')
      .then((r) => {
        setRounds(r);
        const wanted = Number(new URLSearchParams(location.search).get('round'));
        const first = r.findIndex((x) => !picks[x.at]);
        setIndex(wanted >= 1 && wanted <= r.length && Number.isInteger(wanted) ? wanted - 1 : Math.max(0, first));
      })
      .catch(() => setFailure(true));
  }, []);
  const round = rounds[index];
  if (!round)
    return (
      <section id="arena" className="rd-card rd-glass">
        {failure ? 'Archivo no disponible. Recarga para reintentar.' : 'Abriendo el archivo…'}
      </section>
    );
  const chosen = picks[round.at];
  const played = rounds.filter((r) => picks[r.at]);
  const counts = (pick: (r: Round) => string) => played.filter((r) => r.winner === pick(r)).length;
  function choose(team: string) {
    const nextPicks = { ...picks, [round!.at]: team };
    setPicks(nextPicks);
    save('archive-picks', nextPicks);
  }
  const wins = counts((r) => picks[r.at]!);
  function next() {
    const n = (index + 1) % rounds.length;
    setIndex(n);
    const u = new URL(location.href);
    u.searchParams.set('round', String(n + 1));
    u.hash = 'arena';
    history.replaceState(null, '', u);
  }
  return (
    <section id="arena" className="rd-card rd-glass market-box">
      <div className="rd-head">
        <h2 className="rd-title">Vence al archivo</h2>
        <span className="rd-note">
          {wins} aciertos / {played.length} jugados
        </span>
      </div>
      <p className="rd-note">
        21 nov · {clock(round.at)} · Montu {index + 1} de {rounds.length}
      </p>
      <p>
        Uno llega con impulso. El otro tiene el precio más alto entre sus rivales. ¿Cuál subió más en los cinco minutos
        siguientes?
      </p>
      <div className="arc-pair">
        {round.choices.map((c) => (
          <button
            key={c.team}
            className="rd-button rd-button--quiet archive-pick"
            disabled={!!chosen}
            onClick={() => choose(c.team)}
          >
            {teamLabel(c.team)}
            <span className="rd-note">
              {pct(c.price)} · {move(c.before)} previos
            </span>
          </button>
        ))}
      </div>
      {!chosen && (
        <button className="rd-button rd-button--quiet rd-button--small" onClick={() => choose('tie')}>
          Pronosticar empate
        </button>
      )}
      {chosen && (
        <div role="status">
          <p>
            {round.winner === 'tie'
              ? chosen === 'tie'
                ? 'Acertaste el empate.'
                : 'Empate entre los equipos.'
              : chosen === round.winner
              ? 'Acertaste.'
              : 'Ganó ' + teamLabel(round.winner) + '.'}{' '}
            {round.choices.map((c) => teamLabel(c.team) + ' ' + move(c.after)).join(' · ')}
          </p>
          <button className="rd-button rd-button--quiet rd-button--small" onClick={next}>
            Siguiente ronda
          </button>
        </div>
      )}
      {played.length > 0 && (
        <div className="rd-row" aria-label="Aciertos en las mismas rondas">
          <span className="rd-label">Tú · {wins}</span>
          <span className="rd-note">Impulso · {counts((r) => r.impulse)}</span>
          <span className="rd-note">Favorito · {counts((r) => r.favorite)}</span>
        </div>
      )}
      <a className="rd-note" href={'?round=' + (index + 1) + '#arena'}>
        Enlace a esta ronda
      </a>
    </section>
  );
}
