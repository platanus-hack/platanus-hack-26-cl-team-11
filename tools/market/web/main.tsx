import { createRoot } from 'react-dom/client';
import '@fontsource-variable/hanken-grotesk';
import '../../../design/tokens.css';
import '../../../design/ronda.css';
import '../../../frontend/src/app.css';
import { DuelsPage } from '../../../frontend/src/DuelsPage';
import { Terminal } from './Terminal';
import mark from '../../../design/logo/ronda-mark.svg';

const duel = location.pathname === '/duelos';
createRoot(document.getElementById('root')!).render(
  <div className="rd-page">
    <div className="rd-aura" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </div>
    <div className="rd-page__inner">
      <header className="rd-bar">
        <a className="rd-brand" href="/terminal">
          <img className="rd-mark" src={mark} alt="" />
          Ronda
        </a>
        <nav className="market-nav">
          <a href="/terminal#arena">Archivo</a>
          <a href="/agent.md">Para agentes</a>
          <a href="/duelos">Duelos</a>
        </nav>
      </header>
      <main className="app-wide">{duel ? <DuelsPage /> : <Terminal />}</main>
    </div>
  </div>,
);
