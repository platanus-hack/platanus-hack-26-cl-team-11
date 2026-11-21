import type { ReactNode } from 'react';

interface SectionHeadProps {
  title: string;
  first?: boolean;
  end?: ReactNode;
}

export function SectionHead({ title, first = false, end }: SectionHeadProps) {
  const Heading = first ? 'h1' : 'h2';
  return (
    <div className="rd-head">
      <Heading className="rd-title">{title}</Heading>
      {end && <span className="rd-head__end">{end}</span>}
    </div>
  );
}
