import type { ReactNode } from 'react';
import { Glyph } from './Glyph';

interface ItemProps {
  icon: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  end?: ReactNode;
  off?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  href?: string;
}

export function Item({ icon, title, subtitle, end, off = false, expanded, onToggle, href }: ItemProps) {
  const className = `rd-item${off ? ' rd-item--off' : ''}`;
  const opens = Boolean(onToggle || href);
  const content = (
    <>
      {icon}
      <span className="rd-item__text">
        <span className="rd-item__title">{title}</span>
        {subtitle && <span className="rd-item__sub">{subtitle}</span>}
      </span>
      {(end || opens) && (
        <span className="rd-item__end">
          {end}
          {opens && <Glyph name="chevron" />}
        </span>
      )}
    </>
  );

  if (href)
    return (
      <a className={className} href={href}>
        {content}
      </a>
    );
  if (onToggle)
    return (
      <button className={className} type="button" aria-expanded={expanded ?? false} onClick={onToggle}>
        {content}
      </button>
    );
  return <div className={className}>{content}</div>;
}
