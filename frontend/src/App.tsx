import type { ReactNode } from 'react';
import { ConnectPage } from './ConnectPage';
import { ContextPage } from './ContextPage';
import { HomePage } from './HomePage';

function Backdrop({ children }: { children: ReactNode }) {
  return (
    <div className="rd-page">
      <div className="rd-aura" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>
      <div className="rd-page__inner">{children}</div>
    </div>
  );
}

function Shell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <Backdrop>
      <header className="rd-bar">
        <a className="rd-brand" href="/">
          Ronda
        </a>
      </header>
      <main className={wide ? 'app-wide' : 'app-main'}>{children}</main>
    </Backdrop>
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
  if (section === 'conectar' && token)
    return (
      <Backdrop>
        <ConnectPage token={token} />
      </Backdrop>
    );
  return (
    <Shell>
      <HomePage />
    </Shell>
  );
}
