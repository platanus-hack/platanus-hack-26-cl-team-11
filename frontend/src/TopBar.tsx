import markUrl from '../../design/logo/ronda-mark.svg';
import { CopyButton } from './CopyButton';
import { OverflowMenu } from './OverflowMenu';

export function TopBar({ token }: { token: string }) {
  return (
    <header className="app-top">
      <a className="rd-brand" href="/">
        <img className="rd-mark" src={markUrl} alt="" />
        Ronda
      </a>
      <OverflowMenu>
        <a className="rd-menu__item" href={`/contexto/${encodeURIComponent(token)}`}>
          Ver tu mapa de contexto
        </a>
        <CopyButton menu text={window.location.origin + window.location.pathname} label="Copiar tu link" />
      </OverflowMenu>
    </header>
  );
}
