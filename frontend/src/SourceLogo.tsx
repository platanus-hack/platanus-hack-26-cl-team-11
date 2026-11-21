import appleHealth from '../../design/sources/apple-health.png';
import github from '../../design/sources/github.svg';
import gmail from '../../design/sources/gmail.svg';
import googleCalendar from '../../design/sources/google-calendar.svg';
import granola from '../../design/sources/granola.png';
import linear from '../../design/sources/linear.svg';
import { SourceGlyph } from './SourceGlyph';

interface Logo {
  src: string;
  appIcon: boolean;
}

const LOGOS: Record<string, Logo> = {
  apple_health: { src: appleHealth, appIcon: true },
  granola: { src: granola, appIcon: true },
  github: { src: github, appIcon: false },
  linear: { src: linear, appIcon: false },
  google_calendar: { src: googleCalendar, appIcon: false },
  gmail: { src: gmail, appIcon: false },
};

export function SourceLogo({ id }: { id: string }) {
  const logo = LOGOS[id];
  if (!logo)
    return (
      <span className="rd-item__icon">
        <SourceGlyph id={id} />
      </span>
    );
  return (
    <span className={`rd-item__icon${logo.appIcon ? ' rd-item__icon--app' : ''}`}>
      <img src={logo.src} alt="" />
    </span>
  );
}
