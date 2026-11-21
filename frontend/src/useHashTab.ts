import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_TAB, TABS, type TabId } from './tabs';

const NOTICE_PARAM = 'aviso';
const NOTICE_TAB: TabId = 'ajustes';

const fallbackTab = (): TabId => (new URLSearchParams(window.location.search).has(NOTICE_PARAM) ? NOTICE_TAB : DEFAULT_TAB);
const tabOf = (hash: string): TabId => TABS.find((tab) => tab.id === hash.replace(/^#/, ''))?.id ?? fallbackTab();

export function useHashTab() {
  const [tab, setTab] = useState<TabId>(() => tabOf(window.location.hash));

  useEffect(() => {
    const sync = () => setTab(tabOf(window.location.hash));
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  const select = useCallback((next: TabId) => {
    window.location.hash = next;
    setTab(next);
    window.scrollTo(0, 0);
  }, []);

  return { tab, select };
}
