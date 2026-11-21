import { Component, type ReactNode } from 'react';

const RELOAD_KEY = 'montu-recarga';
const RELOAD_GAP_MS = 30_000;

function reloadOnce() {
  try {
    if (Date.now() - Number(window.sessionStorage.getItem(RELOAD_KEY)) < RELOAD_GAP_MS) return;
    window.sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    return;
  }
  window.location.reload();
}

export class CrashGuard extends Component<{ children: ReactNode }, { crashed: boolean }> {
  state = { crashed: false };

  static getDerivedStateFromError() {
    return { crashed: true };
  }

  componentDidCatch() {
    reloadOnce();
  }

  render() {
    if (!this.state.crashed) return this.props.children;
    return (
      <div className="rd-page">
        <div className="rd-page__inner">
          <main className="app-narrow app-main">
            <h1 className="rd-title">No se pudo mostrar esta página</h1>
            <p className="rd-note">Puede que Montu se haya actualizado mientras la tenías abierta. Recárgala para seguir.</p>
            <div className="rd-actions">
              <button className="rd-button" type="button" onClick={() => window.location.reload()}>
                Recargar
              </button>
            </div>
          </main>
        </div>
      </div>
    );
  }
}
