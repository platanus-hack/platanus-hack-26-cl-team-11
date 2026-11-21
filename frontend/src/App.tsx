import { useEffect, useState, type ReactNode } from 'react';
import markUrl from '../../design/logo/montu-mark.svg';
import { DuelsPage } from './DuelsPage';
import { ConnectPage } from './ConnectPage';
import { ContextPage } from './ContextPage';
import { HomePage } from './HomePage';
import { InvitePage } from './InvitePage';
import { JoinPage } from './JoinPage';
import { LoginPage } from './LoginPage';
import { MontuSplash, MontuStage } from './MontuLoader';
import { RoomPage } from './RoomPage';
import { RoomStart } from './RoomStart';
import { fetchLoginOptions, fetchSession } from './api';

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
            Montu
          </a>
        </header>
        <main className={wide ? 'app-wide' : 'app-main'}>{children}</main>
      </div>
    </Backdrop>
  );
}

function Home() {
  const [google, setGoogle] = useState<boolean | null>(null);

  useEffect(() => {
    const options = fetchLoginOptions().then(
      (found) => found.google,
      () => false,
    );
    fetchSession()
      .then(
        (session) => session.person,
        () => null,
      )
      .then(async (person) => {
        if (person) window.location.replace(`/conectar/${encodeURIComponent(person.token)}`);
        else setGoogle(await options);
      });
  }, []);

  if (google === null) return <Backdrop>{null}</Backdrop>;
  if (google)
    return (
      <Backdrop>
        <LoginPage />
      </Backdrop>
    );
  return (
    <Shell>
      <HomePage />
    </Shell>
  );
}

function Screen() {
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
  if (section === 'sala')
    return (
      <Shell>
        <RoomStart />
      </Shell>
    );
  return <Home />;
}

export function App() {
  const [, section] = window.location.pathname.split('/');
  if (section === 'montu') return <MontuStage />;
  return (
    <>
      <Screen />
      <MontuSplash />
    </>
  );
}
