import type { ReactNode } from 'react';

export function ItemIcon({ children }: { children: ReactNode }) {
  return <span className="rd-item__icon">{children}</span>;
}
