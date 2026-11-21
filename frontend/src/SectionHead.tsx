import type { ReactNode } from 'react';

interface SectionHeadProps {
  title: string;
  first?: boolean;
  status?: string;
  live?: boolean;
  end?: ReactNode;
}

export function SectionHead({ title, first = false, status, live = false, end }: SectionHeadProps) {
  const Heading = first ? 'h1' : 'h2';
  return (
    <div className="rd-head">
      <Heading className="rd-title">{title}</Heading>
      {status && (
        <span className="rd-chip rd-glass">
          {live && <span className="rd-dot" />}
          {status}
        </span>
      )}
      {end && <span className="rd-head__end">{end}</span>}
    </div>
  );
}
