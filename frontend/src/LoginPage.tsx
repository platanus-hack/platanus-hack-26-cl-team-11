import googleLogo from '../../design/logo/google-g.svg';
import markUrl from '../../design/logo/montu-mark.svg';
import { GOOGLE_LOGIN_PATH } from './api';

export function LoginPage() {
  return (
    <main className="app-login">
      <div className="app-login__box">
        <img className="rd-mark" src={markUrl} alt="" />
        <h1 className="rd-pagetitle">Entra a Montu</h1>
        <div className="app-login__actions">
          <a className="rd-button app-link" href={GOOGLE_LOGIN_PATH}>
            <img className="app-login__logo" src={googleLogo} alt="" />
            Continuar con Google
          </a>
        </div>
      </div>
    </main>
  );
}
