import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('home wordmark keeps the original size and tracking', () => {
  const source = readFileSync(new URL('./Home.tsx', import.meta.url), 'utf8');

  assert.match(source, /text-\[clamp\(36px,6vw,72px\)\]/);
  assert.match(source, /tracking-\[0\.02em\]/);
  assert.doesNotMatch(source, /text-\[clamp\(48px,9vw,120px\)\]/);
});
