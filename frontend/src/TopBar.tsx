import markUrl from '../../design/logo/montu-mark.svg';
import { CopyButton } from './CopyButton';
import { OverflowMenu } from './OverflowMenu';

export function TopBar() {
  return (
    <header className="app-top">
      <a className="rd-brand" href="/">
        <img className="rd-mark" src={markUrl} alt="" />
        Montu
      </a>
      <OverflowMenu>
        <CopyButton menu text={window.location.origin + window.location.pathname} label="Copiar tu link" />
      </OverflowMenu>
    </header>
  );
}
