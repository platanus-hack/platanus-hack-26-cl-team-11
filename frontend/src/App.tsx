import type { ReactNode } from 'react';
import { ConnectPage } from './ConnectPage';
import { ContextPage } from './ContextPage';
import { HomePage } from './HomePage';

function Shell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="rd-page">
      <div className="rd-aura" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>
      <div className="rd-page__inner">
        <header className="rd-bar">
          <a className="rd-brand" href="/">
            Ronda
          </a>
        </header>
        <main className={wide ? 'app-wide' : 'app-main'}>{children}</main>
      </div>
    </div>
  );
}

export function App() {
  const [, section, token] = window.location.pathname.split('/');
  if (section === 'contexto' && token)
    return (
      <Shell wide>
        <ContextPage token={token} />
      </Shell>
    );
  return <Shell>{section === 'conectar' && token ? <ConnectPage token={token} /> : <HomePage />}</Shell>;
}
