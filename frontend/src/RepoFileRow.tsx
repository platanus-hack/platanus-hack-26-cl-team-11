import { useEffect, useState } from 'react';
import type { Visibility } from './api';
import { formatAgo } from './ago';
import { messageOf } from './format';
import { Glyph } from './Glyph';
import { Item } from './Item';
import { ItemIcon } from './ItemIcon';
import { deleteRepoFile, fetchRepoFile, setRepoShare, type RepoEntry } from './roomApi';
import { RowButton } from './RowButton';
import { VISIBILITY_LABEL } from './signalGroups';
import { useAction } from './useAction';
import { VisibilityChoice } from './VisibilityChoice';
import { MontuInline } from './MontuLoader';

interface RepoFileRowProps {
  token: string;
  entry: RepoEntry;
  open: boolean;
  onToggle: () => void;
  onChange: () => void;
}

const AUTHOR_LABEL: Record<string, string> = { persona: 'Tú' };

export function RepoFileRow({ token, entry, open, onToggle, onChange }: RepoFileRowProps) {
  const [content, setContent] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const { busy, error, run } = useAction();

  useEffect(() => {
    if (!open) return;
    let current = true;
    fetchRepoFile(token, entry.path).then(
      (file) => current && setContent(file.content),
      (failure: unknown) => current && setProblem(messageOf(failure, 'No se pudo abrir.')),
    );
    return () => {
      current = false;
    };
  }, [open, token, entry.path, entry.updatedAt]);

  const share = (visibility: Visibility) =>
    void run(async () => {
      await setRepoShare(token, entry.path, visibility);
      onChange();
    });
  const remove = () =>
    void run(async () => {
      await deleteRepoFile(token, entry.path);
      onChange();
    });

  const author = AUTHOR_LABEL[entry.updatedBy] ?? entry.updatedBy;

  return (
    <div>
      <Item
        icon={
          <ItemIcon>
            <Glyph name="file" />
          </ItemIcon>
        }
        title={entry.path}
        subtitle={`${VISIBILITY_LABEL[entry.share]} · ${author} · ${formatAgo(entry.updatedAt, Date.now())}`}
        expanded={open}
        onToggle={onToggle}
      />
      {open && (
        <div className="rd-item__detail">
          {content !== null && <p className="app-body">{content}</p>}
          {content === null && !problem && <MontuInline />}
          <VisibilityChoice label={`Quién ve ${entry.path}`} value={entry.share} disabled={busy} onChange={share} />
          <div className="rd-actions">
            <RowButton label="Borrar" name={`Borrar ${entry.path}`} disabled={busy} onClick={remove} />
          </div>
          {(problem ?? error) && (
            <span className="rd-note" role="alert">
              {problem ?? error}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
