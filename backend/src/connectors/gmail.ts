import { getGoogleJson } from '../oauth/google.js';
import type { EventDraft, OAuthConnector } from '../types.js';

const MESSAGES_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages';
const MAX_MESSAGES_PER_PULL = 25;
const METADATA_QUERY = 'format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date';

interface GmailList {
  messages?: Array<{ id: string }>;
}

interface GmailMessage {
  id: string;
  internalDate?: string;
  labelIds?: string[];
  payload?: { headers?: Array<{ name: string; value: string }> };
}

const headerOf = (message: GmailMessage, name: string): string =>
  message.payload?.headers?.find((header) => header.name.toLowerCase() === name.toLowerCase())?.value.trim() ?? '';

const senderName = (from: string): string => from.replace(/<[^>]*>/, '').replace(/"/g, '').trim() || from.replace(/[<>]/g, '').trim() || 'remitente desconocido';

const sentAt = (message: GmailMessage): Date => (message.internalDate ? new Date(Number(message.internalDate)) : new Date(headerOf(message, 'Date')));

function toDraft(message: GmailMessage, since: Date): EventDraft | null {
  const date = sentAt(message);
  if (Number.isNaN(date.getTime()) || date < since || message.labelIds?.includes('DRAFT')) return null;
  const subject = headerOf(message, 'Subject') || '(sin asunto)';
  const from = headerOf(message, 'From');
  return {
    source: 'gmail',
    type: 'correo',
    externalId: message.id,
    occurredAt: date.toISOString(),
    summary: `${subject} · de ${senderName(from)}`,
    raw: { subject, from, date: date.toISOString() },
  };
}

export const gmail: OAuthConnector = {
  id: 'gmail',
  label: 'Gmail',
  how: 'Cuenta de Google',
  kind: 'oauth',
  provider: 'google',
  scopes: ['https://www.googleapis.com/auth/gmail.metadata'],

  async pull(accessToken, _account, since, fetchImpl) {
    const list = await getGoogleJson<GmailList>(fetchImpl, `${MESSAGES_URL}?maxResults=${MAX_MESSAGES_PER_PULL}`, accessToken, 'Gmail');
    const messages = await Promise.all(
      (list.messages ?? []).map((item) => getGoogleJson<GmailMessage>(fetchImpl, `${MESSAGES_URL}/${encodeURIComponent(item.id)}?${METADATA_QUERY}`, accessToken, 'Gmail')),
    );
    return messages.map((message) => toDraft(message, since)).filter((draft): draft is EventDraft => draft !== null);
  },
};
