import { createRoot } from 'react-dom/client';
import '@fontsource-variable/hanken-grotesk';
import '../../../design/tokens.css';
import '../../../design/ronda.css';
import '../../../frontend/src/app.css';
import { DuelsPage } from '../../../frontend/src/DuelsPage';

createRoot(document.getElementById('root')!).render(
  <div className="rd-page">
    <div className="rd-aura" aria-hidden="true"><i /><i /><i /><i /></div>
    <div className="rd-page__inner">
      <header className="rd-bar"><a className="rd-brand" href="/duelos">Ronda</a></header>
      <main className="app-wide"><DuelsPage /></main>
    </div>
  </div>
);
