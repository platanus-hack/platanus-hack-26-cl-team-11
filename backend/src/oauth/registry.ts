import type { OAuthProvider } from '../types.js';
import { github } from './github.js';
import { google } from './google.js';
import { linear } from './linear.js';

export const OAUTH_PROVIDERS: Record<string, OAuthProvider> = { google, github, linear };
