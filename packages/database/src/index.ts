import { PrismaClient } from '@prisma/client';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

export * from '@prisma/client';

let prisma: PrismaClient | undefined;

export function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

const FIELD_KEY = () =>
  createHash('sha256')
    .update(process.env.FIELD_ENCRYPTION_KEY ?? 'dev-only-field-key-change-me')
    .digest();

/** Current encryption version */
const ENCRYPTION_VERSION = 'v1';

/** AES-256-GCM field-level encryption for PII payloads at rest.
 * Format: v1:iv:tag:data (all base64, colon-separated)
 */
export function encryptField(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', FIELD_KEY(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [
    ENCRYPTION_VERSION,
    iv.toString('base64'),
    cipher.getAuthTag().toString('base64'),
    enc.toString('base64'),
  ].join(':');
}

export function decryptField(payload: string): string {
  const parts = payload.split(':');
  if (parts.length === 3) {
    // Legacy format (v0): iv:tag:data
    const [ivB64, tagB64, dataB64] = parts;
    const decipher = createDecipheriv('aes-256-gcm', FIELD_KEY(), Buffer.from(ivB64!, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64!, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64!, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }
  if (parts.length === 4) {
    // Current format (v1): v1:iv:tag:data
    const [version, ivB64, tagB64, dataB64] = parts;
    if (version !== ENCRYPTION_VERSION) {
      throw new Error(`Unsupported encryption version: ${version}`);
    }
    const decipher = createDecipheriv('aes-256-gcm', FIELD_KEY(), Buffer.from(ivB64!, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64!, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64!, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }
  throw new Error(`Invalid encrypted payload format: ${payload}`);
}
