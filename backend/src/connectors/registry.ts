import type { Connector, SourceId } from '../types.js';
import { appleHealth } from './appleHealth.js';
import { github } from './github.js';
import { gmail } from './gmail.js';
import { googleCalendar } from './googleCalendar.js';
import { granola } from './granola.js';
import { linear } from './linear.js';

export const CONNECTORS: Connector[] = [
  appleHealth,
  granola,
  github,
  linear,
  googleCalendar,
  gmail,
];

export const findConnector = (id: SourceId): Connector | undefined => CONNECTORS.find((connector) => connector.id === id);
