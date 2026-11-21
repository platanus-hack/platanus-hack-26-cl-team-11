import type { OAuthProvider } from '../types.js';
import { google } from './google.js';

export const OAUTH_PROVIDERS: Record<string, OAuthProvider> = { google };
