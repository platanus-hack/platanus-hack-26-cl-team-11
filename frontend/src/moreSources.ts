import drive from '../../design/sources/apps/drive.png';
import garmin from '../../design/sources/apps/garmin.png';
import meet from '../../design/sources/apps/meet.png';
import notion from '../../design/sources/apps/notion.png';
import oura from '../../design/sources/apps/oura.png';
import outlook from '../../design/sources/apps/outlook.png';
import slack from '../../design/sources/apps/slack.png';
import strava from '../../design/sources/apps/strava.png';
import telegram from '../../design/sources/apps/telegram.png';
import whoop from '../../design/sources/apps/whoop.png';
import zoom from '../../design/sources/apps/zoom.png';

export interface MoreSource {
  id: string;
  label: string;
  icon: string;
}

export const MORE_SOURCES: readonly MoreSource[] = [
  { id: 'slack', label: 'Slack', icon: slack },
  { id: 'notion', label: 'Notion', icon: notion },
  { id: 'strava', label: 'Strava', icon: strava },
  { id: 'oura', label: 'Oura', icon: oura },
  { id: 'whoop', label: 'Whoop', icon: whoop },
  { id: 'garmin', label: 'Garmin', icon: garmin },
  { id: 'zoom', label: 'Zoom', icon: zoom },
  { id: 'meet', label: 'Google Meet', icon: meet },
  { id: 'outlook', label: 'Outlook', icon: outlook },
  { id: 'drive', label: 'Google Drive', icon: drive },
  { id: 'telegram', label: 'Telegram', icon: telegram },
];

const keyOf = (token: string) => `ronda:fuentes-pedidas:${token}`;

export function readWanted(token: string): string[] {
  try {
    const saved: unknown = JSON.parse(window.localStorage.getItem(keyOf(token)) ?? '[]');
    return Array.isArray(saved) ? saved.filter((id): id is string => MORE_SOURCES.some((source) => source.id === id)) : [];
  } catch {
    return [];
  }
}

export function saveWanted(token: string, ids: string[]) {
  try {
    window.localStorage.setItem(keyOf(token), JSON.stringify(ids));
  } catch {
    return;
  }
}
