import type { Signals, Source } from './api';
import { CheckinSection } from './CheckinSection';
import { Face } from './Face';
import { Item } from './Item';
import { SectionHead } from './SectionHead';
import { SignalsSection } from './SignalsSection';

interface YouTabProps {
  token: string;
  name: string;
  signals: Signals | null;
  sources: Source[];
  onSaved: () => void;
}

export function YouTab({ token, name, signals, sources, onSaved }: YouTabProps) {
  return (
    <>
      <div className="app-block">
        <SectionHead first title="Tú" />
        <div className="rd-list">
          <Item icon={<Face name={name} />} title={name} />
        </div>
      </div>
      <CheckinSection token={token} onSaved={onSaved} />
      {signals && <SignalsSection signals={signals} sources={sources} />}
    </>
  );
}
