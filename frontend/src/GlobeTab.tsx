import { useEffect, useState } from 'react';

const UNIVERSE_PATH = '/design/grafo/universo.html?embed';

export function GlobeTab({ active }: { active: boolean }) {
  const [opened, setOpened] = useState(active);

  useEffect(() => {
    if (active) setOpened(true);
  }, [active]);

  return (
    <div className="app-block">
      {opened && <iframe className="app-universe" title="Globo de agentes conversando" src={UNIVERSE_PATH} />}
      <p className="rd-note">El globo es una demo con datos de prueba.</p>
    </div>
  );
}
