import 'server-only';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { authSecret } from './session';

/**
 * Tashqi xizmat kalitlarini (Meta App Secret, sahifa tokeni) bazada shifrlab saqlash: AES-256-GCM.
 * Kalit AUTH_SECRET dan olinadi — baza o'g'irlansa ham tokenlar o'qilmaydi.
 */
const key = () => createHash('sha256').update(authSecret() + ':integrations:v1').digest();

export function seal(data: unknown): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(JSON.stringify(data), 'utf8'), c.final()]);
  return ['v1', iv.toString('base64url'), c.getAuthTag().toString('base64url'), enc.toString('base64url')].join('.');
}

export function unseal<T>(blob: string | null | undefined): T | null {
  if (!blob) return null;
  try {
    const [v, iv, tag, enc] = blob.split('.');
    if (v !== 'v1') return null;
    const d = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
    d.setAuthTag(Buffer.from(tag, 'base64url'));
    return JSON.parse(Buffer.concat([d.update(Buffer.from(enc, 'base64url')), d.final()]).toString('utf8')) as T;
  } catch {
    return null;
  }
}
