import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('generate console prompt uses the native textarea caret instead of a fake overlay cursor', () => {
  const source = readFileSync(new URL('./GenerateConsole.tsx', import.meta.url), 'utf8');

  assert.match(source, /caret-white/);
  assert.doesNotMatch(source, /absolute bottom-2 right-0 w-\[2px\] h-\[18px\] bg-white/);
});
