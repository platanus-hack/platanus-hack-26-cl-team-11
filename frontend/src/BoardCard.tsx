import { useCallback, useState } from 'react';
import { fetchOpenPosts, type BoardPost } from './api';
import { BoardPostItem } from './BoardPostItem';
import { PostForm } from './PostForm';
import { usePolling } from './usePolling';

export function BoardCard({ token, teamId }: { token: string; teamId: string }) {
  const [posts, setPosts] = useState<BoardPost[] | null>(null);

  const load = useCallback(async () => setPosts((await fetchOpenPosts(token, teamId)).posts), [token, teamId]);
  const { error, refresh } = usePolling(load);

  return (
    <section className="rd-card rd-glass">
      <span className="rd-label">Tablero del equipo</span>
      <PostForm token={token} teamId={teamId} onPublished={refresh} />
      {error && (
        <p className="rd-note" role="alert">
          {error}
        </p>
      )}
      {!posts && !error && <p className="rd-note">Cargando…</p>}
      {posts?.length === 0 && <p className="rd-note">No hay publicaciones abiertas.</p>}
      {posts?.map((post) => (
        <BoardPostItem key={post.id} token={token} post={post} onChange={refresh} />
      ))}
    </section>
  );
}
