import type { KeyConnector, SourceId } from '../types.js';
import { github } from './github.js';
import { granola } from './granola.js';

export const KEY_CONNECTORS: Partial<Record<SourceId, KeyConnector>> = { granola, github };
