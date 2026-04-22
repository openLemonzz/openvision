import test from 'node:test';
import assert from 'node:assert/strict';

import {
  decryptSecret,
  encryptSecret,
  fingerprintSecretKey,
} from './secret-crypto.ts';

test('encryptSecret and decryptSecret round-trip a model secret', async () => {
  const ciphertext = await encryptSecret('sk-test-secret', 'vision-crypt-key');

  assert.match(ciphertext, /^v1\./);
  assert.notEqual(ciphertext, 'sk-test-secret');

  const plaintext = await decryptSecret(ciphertext, 'vision-crypt-key');
  assert.equal(plaintext, 'sk-test-secret');
});

test('fingerprintSecretKey is deterministic for the same passphrase', async () => {
  const first = await fingerprintSecretKey('vision-crypt-key');
  const second = await fingerprintSecretKey('vision-crypt-key');
  const different = await fingerprintSecretKey('different-key');

  assert.equal(first, second);
  assert.notEqual(first, different);
});

test('encryptSecret rejects an empty passphrase', async () => {
  await assert.rejects(
    () => encryptSecret('sk-test-secret', '   '),
    /CONFIG_CRYPT_KEY is required/
  );
});
