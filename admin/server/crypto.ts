import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

function getKey(secret: string) {
  return createHash('sha256').update(secret.trim()).digest();
}

export function encryptSecret(plaintext: string, secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    'v1',
    iv.toString('base64'),
    encrypted.toString('base64'),
    tag.toString('base64'),
  ].join('.');
}

export function decryptSecret(payload: string, secret: string) {
  const [version, ivValue, encryptedValue, tagValue] = payload.split('.');
  if (version !== 'v1' || !ivValue || !encryptedValue || !tagValue) {
    throw new Error('Invalid encrypted secret payload');
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    getKey(secret),
    Buffer.from(ivValue, 'base64')
  );
  decipher.setAuthTag(Buffer.from(tagValue, 'base64'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}
