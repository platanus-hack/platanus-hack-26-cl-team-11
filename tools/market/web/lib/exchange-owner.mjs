import { createHash, timingSafeEqual } from 'node:crypto';

export function isOwner(authorization, expectedHash) {
  if (!/^[0-9a-f]{64}$/.test(expectedHash ?? '') || typeof authorization !== 'string') return false;
  const match = /^Bearer (org_[A-Za-z0-9_-]{43})$/.exec(authorization);
  if (!match) return false;
  const supplied = createHash('sha256').update(match[1]).digest();
  return timingSafeEqual(supplied, Buffer.from(expectedHash, 'hex'));
}
