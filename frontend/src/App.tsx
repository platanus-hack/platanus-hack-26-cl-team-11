import type { ReactNode } from 'react';
import markUrl from '../../design/logo/ronda-mark.svg';
import { DuelsPage } from './DuelsPage';
import { ConnectPage } from './ConnectPage';
import { ContextPage } from './ContextPage';
import { HomePage } from './HomePage';
import { InvitePage } from './InvitePage';
import { JoinPage } from './JoinPage';
import { RoomPage } from './RoomPage';

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
      <div className={wide ? undefined : 'app-narrow'}>
        <header className="rd-bar">
          <a className="rd-brand" href="/">
            <img className="rd-mark" src={markUrl} alt="" />
            Ronda
          </a>
        </header>
        <main className={wide ? 'app-wide' : 'app-main'}>{children}</main>
      </div>
    </Backdrop>
  );
}

export function App() {
  const [, section, token] = window.location.pathname.split('/');
  if (section === 'duelos') return <Shell wide><DuelsPage /></Shell>;
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
  if (section === 'unirse' && token)
    return (
      <Shell>
        <JoinPage code={token} />
      </Shell>
    );
  if (section === 'invitacion' && token)
    return (
      <Shell>
        <InvitePage code={token} />
      </Shell>
    );
  if (section === 'sala' && token)
    return (
      <Shell wide>
        <RoomPage code={token} />
      </Shell>
    );
  return (
    <Shell>
      <HomePage />
    </Shell>
  );
}
