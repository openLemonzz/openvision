import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { resolveAppShellState } from './app-shell.ts';

test('app shell mounts the toast presenter used by async actions', () => {
  const appSource = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');

  assert.match(appSource, /import\s+\{\s*Toaster\s*\}\s+from ['"]\.\/components\/ui\/sonner['"]/);
  assert.match(appSource, /<Toaster\b/);
});

test('normal initialization checks do not block routing or show a loading overlay', () => {
  assert.deepEqual(resolveAppShellState('checking'), {
    shouldMountRoutes: true,
    shouldShowInitializationScreen: false,
  });
  assert.deepEqual(resolveAppShellState('ready'), {
    shouldMountRoutes: true,
    shouldShowInitializationScreen: false,
  });
});

test('initialization problems still surface an actionable screen', () => {
  assert.deepEqual(resolveAppShellState('config-missing'), {
    shouldMountRoutes: false,
    shouldShowInitializationScreen: true,
  });
  assert.deepEqual(resolveAppShellState('network-error'), {
    shouldMountRoutes: true,
    shouldShowInitializationScreen: true,
  });
  assert.deepEqual(resolveAppShellState('backend-uninitialized'), {
    shouldMountRoutes: true,
    shouldShowInitializationScreen: true,
  });
});
