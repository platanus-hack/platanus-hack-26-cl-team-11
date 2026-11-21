import { useEffect, useState } from 'react';
import { MesaSection } from './MesaSection';

const UNIVERSE_PATH = '/design/grafo/universo.html?embed';

export function GlobeTab({ token, active }: { token: string; active: boolean }) {
  const [opened, setOpened] = useState(active);

  useEffect(() => {
    if (active) setOpened(true);
  }, [active]);

  return (
    <>
      <div className="app-block">
        {opened && <iframe className="app-universe" title="Globo de agentes conversando" src={UNIVERSE_PATH} />}
        <p className="rd-note">El globo es una demo con datos de prueba. La mesa de abajo es real.</p>
      </div>
      {opened && <MesaSection token={token} />}
    </>
  );
}
