import { useState } from 'react';
import type { PersonPage } from './api';
import { SectionHead } from './SectionHead';
import { SourceRow } from './SourceRow';

interface SourcesTabProps {
  token: string;
  page: PersonPage;
  notice: string | null;
  onChange: () => void;
}

export function SourcesTab({ token, page, notice, onChange }: SourcesTabProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const ingestUrl = `${page.publicBaseUrl ?? window.location.origin}${page.healthIngestPath}`;

  return (
    <div className="app-block">
      <SectionHead first title="Fuentes" />
      {notice && (
        <p className="rd-note" role="status">
          {notice}
        </p>
      )}
      <div className="rd-list">
        {page.sources.map((source) => (
          <SourceRow
            key={source.id}
            token={token}
            source={source}
            ingestUrl={ingestUrl}
            healthShortcut={page.healthShortcut}
            open={openId === source.id}
            onToggle={() => setOpenId((current) => (current === source.id ? null : source.id))}
            onChange={onChange}
          />
        ))}
      </div>
    </div>
  );
}
