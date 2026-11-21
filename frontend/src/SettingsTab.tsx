import { useState } from 'react';
import type { SignalKey } from './api';
import { CopyButton } from './CopyButton';
import { Glyph } from './Glyph';
import { Item } from './Item';
import { ItemIcon } from './ItemIcon';
import { PermissionRow } from './PermissionRow';
import { RowButton } from './RowButton';
import { SectionHead } from './SectionHead';
import { SIGNAL_GROUPS } from './signalGroups';
import { usePolicy } from './usePolicy';

export function SettingsTab({ token }: { token: string }) {
  const { policy, busy, problem, change } = usePolicy(token);
  const [openKey, setOpenKey] = useState<SignalKey | null>(null);
  const link = window.location.origin + window.location.pathname;

  return (
    <>
      <div className="app-block">
        <SectionHead first title="Permisos" />
        {!policy && !problem && <p className="rd-note">Cargando…</p>}
        {problem && (
          <p className="rd-note" role="alert">
            {problem}
          </p>
        )}
        <div className="rd-list">
          {SIGNAL_GROUPS.map((group) => (
            <PermissionRow
              key={group.key}
              group={group}
              visibility={policy ? policy[group.key] : null}
              disabled={busy}
              open={openKey === group.key}
              onToggle={() => setOpenKey((current) => (current === group.key ? null : group.key))}
              onChange={(visibility) => void change({ [group.key]: visibility })}
            />
          ))}
        </div>
      </div>

      <div className="app-block">
        <SectionHead title="Pulso del equipo" />
        <div className="rd-list">
          <Item
            icon={
              <ItemIcon>
                <Glyph name="pulse" />
              </ItemIcon>
            }
            title="Participar en el pulso"
            subtitle="Nunca muestra tu nombre"
            end={
              policy ? (
                <RowButton
                  label={policy.includeInPulse ? 'Pausar' : 'Activar'}
                  name={policy.includeInPulse ? 'Pausar tu participación en el pulso' : 'Activar tu participación en el pulso'}
                  disabled={busy}
                  onClick={() => void change({ includeInPulse: !policy.includeInPulse })}
                />
              ) : undefined
            }
          />
        </div>
        <p className="rd-note">Lo que dejes en «Privado» tampoco entra al pulso.</p>
      </div>

      <div className="app-block">
        <SectionHead title="Tu link" />
        <div className="rd-list">
          <Item
            icon={
              <ItemIcon>
                <Glyph name="link" />
              </ItemIcon>
            }
            title="Tu página personal"
            subtitle={link}
            end={<CopyButton text={link} label="Copiar tu link" />}
          />
          <Item
            icon={
              <ItemIcon>
                <Glyph name="map" />
              </ItemIcon>
            }
            title="Mapa de contexto"
            subtitle="Tus fuentes alrededor de ti"
            href={`/contexto/${encodeURIComponent(token)}`}
          />
        </div>
        <p className="rd-note">Tu link es personal. Quien lo tenga puede ver tus registros.</p>
      </div>
    </>
  );
}
