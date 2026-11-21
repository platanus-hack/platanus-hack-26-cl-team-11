import { useState, type ReactNode } from 'react';
import { googleLinkPath, type OnboardingStep, type OnboardingStepId, type SignalKey, type PersonLogin } from './api';
import { CopyButton } from './CopyButton';
import { FaceEditor } from './FaceEditor';
import { Glyph } from './Glyph';
import { Item } from './Item';
import { OnboardingSection } from './OnboardingSection';
import { ItemIcon } from './ItemIcon';
import { PermissionRow } from './PermissionRow';
import { RepoSection } from './RepoSection';
import { RowButton } from './RowButton';
import { SectionHead } from './SectionHead';
import { SIGNAL_GROUPS } from './signalGroups';
import { TeamAdminSection } from './TeamAdminSection';
import { usePolicy } from './usePolicy';
import { WhatsAppSection } from './WhatsAppSection';

interface SettingsTabProps {
  token: string;
  name: string;
  login: PersonLogin | null;
  firstSteps: OnboardingStep[];
  onOpenStep: (step: OnboardingStepId) => void;
  sources: ReactNode;
}

export function SettingsTab({ token, name, login, firstSteps, onOpenStep, sources }: SettingsTabProps) {
  const { policy, busy, problem, change } = usePolicy(token);
  const [openKey, setOpenKey] = useState<SignalKey | null>(null);

  return (
    <>
      <OnboardingSection steps={firstSteps} onOpen={onOpenStep} />

      {sources}

      <FaceEditor token={token} name={name} />

      <div className="app-block">
        <SectionHead title="Permisos" />
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

      <TeamAdminSection token={token} />

      <RepoSection token={token} />

      {login && (login.email || login.available) && (
        <div className="app-block">
          <SectionHead title="Tu cuenta" />
          <div className="rd-list">
            <Item
              icon={
                <ItemIcon>
                  <Glyph name="key" />
                </ItemIcon>
              }
              title="Entrar con Google"
              subtitle={login.email ?? 'Para volver a tu página desde cualquier dispositivo'}
              end={
                login.email ? undefined : (
                  <a className="rd-button rd-button--quiet rd-button--small app-link" href={googleLinkPath(token)} aria-label="Asociar tu cuenta de Google">
                    Asociar
                  </a>
                )
              }
            />
          </div>
        </div>
      )}
    </>
  );
}
