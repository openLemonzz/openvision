const encoder = new TextEncoder();
const decoder = new TextDecoder();
const IV_LENGTH = 12;

function requirePassphrase(passphrase: string) {
  const normalized = passphrase.trim();
  if (!normalized) {
    throw new Error('CONFIG_CRYPT_KEY is required');
  }

  return normalized;
}

function encodeBase64(bytes: Uint8Array) {
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function decodeBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function deriveSecretKey(passphrase: string) {
  const normalized = requirePassphrase(passphrase);
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(normalized));

  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ]);
}

export async function fingerprintSecretKey(passphrase: string) {
  const normalized = requirePassphrase(passphrase);
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(normalized));

  return encodeBase64(new Uint8Array(digest));
}

export async function encryptSecret(plaintext: string, passphrase: string) {
  const key = await deriveSecretKey(passphrase);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plaintext)
  );

  return `v1.${encodeBase64(iv)}.${encodeBase64(new Uint8Array(ciphertext))}`;
}

export async function decryptSecret(ciphertext: string, passphrase: string) {
  const [version, encodedIv, encodedPayload] = ciphertext.split('.');

  if (version !== 'v1' || !encodedIv || !encodedPayload) {
    throw new Error('Invalid encrypted secret payload');
  }

  const key = await deriveSecretKey(passphrase);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: decodeBase64(encodedIv) },
    key,
    decodeBase64(encodedPayload)
  );

  return decoder.decode(plaintext);
}
