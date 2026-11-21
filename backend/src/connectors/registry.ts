import type { Connector, SoonConnector, SourceId } from '../types.js';
import { appleHealth } from './appleHealth.js';
import { github } from './github.js';
import { granola } from './granola.js';
import { linear } from './linear.js';

const soon = (id: SourceId, label: string, how: string): SoonConnector => ({ id, label, how, kind: 'soon' });

export const CONNECTORS: Connector[] = [
  appleHealth,
  granola,
  github,
  linear,
  soon('google_calendar', 'Google Calendar', 'Cuenta de Google'),
  soon('gmail', 'Gmail', 'Cuenta de Google'),
];

export const findConnector = (id: SourceId): Connector | undefined => CONNECTORS.find((connector) => connector.id === id);
