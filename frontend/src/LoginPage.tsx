import { useMemo } from 'react';
import googleLogo from '../../design/logo/google-g.svg';
import markUrl from '../../design/logo/montu-mark.svg';
import { GOOGLE_LOGIN_PATH } from './api';
import { readSavedPerson } from './savedPerson';

export function LoginPage() {
  const saved = useMemo(readSavedPerson, []);

  return (
    <main className="app-login">
      <div className="app-login__box">
        <img className="rd-mark" src={markUrl} alt="" />
        <h1 className="rd-pagetitle">Entra a Montu</h1>
        <p className="rd-pagesub">Con tu cuenta de Google. La usamos solo para reconocerte.</p>
        <div className="app-login__actions">
          <a className="rd-button app-link" href={GOOGLE_LOGIN_PATH}>
            <img className="app-login__logo" src={googleLogo} alt="" />
            Continuar con Google
          </a>
          {saved && (
            <a className="rd-button rd-button--quiet app-link" href={`/conectar/${encodeURIComponent(saved.token)}`}>
              Seguir como {saved.name}
            </a>
          )}
        </div>
      </div>
    </main>
  );
}
