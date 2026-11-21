import markUrl from '../../design/logo/montu-mark.svg';
import { closeSession } from './api';
import { CopyButton } from './CopyButton';
import { OverflowMenu } from './OverflowMenu';
import { forgetSavedPerson } from './savedPerson';

async function leave() {
  await closeSession().catch(() => undefined);
  forgetSavedPerson();
  window.location.assign('/');
}

export function TopBar() {
  return (
    <header className="app-top">
      <a className="rd-brand" href="/">
        <img className="rd-mark" src={markUrl} alt="" />
        Montu
      </a>
      <OverflowMenu>
        <CopyButton menu text={window.location.origin + window.location.pathname} label="Copiar tu link" />
        <button className="rd-menu__item" type="button" onClick={() => void leave()}>
          Cerrar sesión
        </button>
      </OverflowMenu>
    </header>
  );
}
