import { useCallback, useState } from 'react';
import { formatAgo } from './ago';
import { fetchChat, type ChatMessage } from './api';
import { Glyph } from './Glyph';
import { Item } from './Item';
import { ItemIcon } from './ItemIcon';
import { SectionHead } from './SectionHead';
import { usePolling } from './usePolling';

const MAX_NOTICES = 5;
const REFRESH_MS = 30_000;

export function NoticesSection({ token }: { token: string }) {
  const [notices, setNotices] = useState<ChatMessage[]>([]);
  const load = useCallback(async () => {
    const { messages } = await fetchChat(token);
    setNotices(messages.filter((message) => message.role === 'agente' && message.options.length === 0).slice(-MAX_NOTICES).reverse());
  }, [token]);
  usePolling(load, REFRESH_MS);

  if (notices.length === 0) return null;
  return (
    <div className="app-block">
      <SectionHead title="Avisos de tu agente" />
      <div className="rd-list">
        {notices.map((notice) => (
          <Item
            key={notice.key}
            icon={
              <ItemIcon>
                <Glyph name="agent" />
              </ItemIcon>
            }
            title={notice.text}
            subtitle={formatAgo(notice.at, Date.now())}
          />
        ))}
      </div>
    </div>
  );
}
