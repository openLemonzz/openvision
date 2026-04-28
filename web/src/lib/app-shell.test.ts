import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('app shell mounts the toast presenter used by async actions', () => {
  const appSource = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');

  assert.match(appSource, /import\s+\{\s*Toaster\s*\}\s+from ['"]\.\/components\/ui\/sonner['"]/);
  assert.match(appSource, /<Toaster\b/);
});
