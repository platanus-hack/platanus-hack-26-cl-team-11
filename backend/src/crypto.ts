import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface Vault {
  seal(plain: string): string;
  open(sealed: string): string;
}

function loadKeyMaterial(dataDir: string | null): string {
  if (process.env.SECRET_KEY) return process.env.SECRET_KEY;
  if (!dataDir) return randomBytes(32).toString('hex');
  const file = join(dataDir, 'secret.key');
  if (existsSync(file)) return readFileSync(file, 'utf8').trim();
  const generated = randomBytes(32).toString('hex');
  writeFileSync(file, generated, { mode: 0o600 });
  return generated;
}

export function createVault(dataDir: string | null): Vault {
  const key = createHash('sha256').update(loadKeyMaterial(dataDir)).digest();
  return {
    seal(plain) {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
      return [iv, cipher.getAuthTag(), body].map((part) => part.toString('base64url')).join('.');
    },
    open(sealed) {
      const [iv, tag, body] = sealed.split('.').map((part) => Buffer.from(part, 'base64url'));
      if (!iv || !tag || !body) throw new Error('credencial ilegible');
      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
    },
  };
}
