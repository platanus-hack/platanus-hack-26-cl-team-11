import { useCallback, useState } from 'react';
import { fetchOpenPosts, type BoardPost } from './api';
import { BoardPostItem } from './BoardPostItem';
import { IconButton } from './IconButton';
import { PostForm } from './PostForm';
import { SectionHead } from './SectionHead';
import { usePolling } from './usePolling';

export function BoardSection({ token, teamId }: { token: string; teamId: string }) {
  const [posts, setPosts] = useState<BoardPost[] | null>(null);
  const [configured, setConfigured] = useState(false);
  const [composing, setComposing] = useState(false);

  const load = useCallback(async () => {
    const board = await fetchOpenPosts(token, teamId);
    setPosts(board.posts);
    setConfigured(board.configured);
  }, [token, teamId]);
  const { error, refresh } = usePolling(load);

  async function published() {
    setComposing(false);
    await refresh();
  }

  return (
    <div className="app-block">
      <SectionHead title="Tablero" end={<IconButton glyph="plus" label="Publicar en el tablero" expanded={composing} onClick={() => setComposing((current) => !current)} />} />
      {composing && <PostForm token={token} teamId={teamId} onPublished={published} />}
      {error && (
        <p className="rd-note" role="alert">
          {error}
        </p>
      )}
      {!posts && !error && <p className="rd-note">Cargando…</p>}
      {posts?.length === 0 && <p className="rd-note">No hay publicaciones abiertas.</p>}
      <div className="rd-list">
        {posts?.map((post) => (
          <BoardPostItem key={post.id} token={token} post={post} configured={configured} onChange={refresh} />
        ))}
      </div>
    </div>
  );
}
