import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('generation surfaces render a prompt copy control next to prompt text', () => {
  const historyStream = readFileSync(new URL('./HistoryStream.tsx', import.meta.url), 'utf8');
  const consoleGenerations = readFileSync(new URL('../pages/console/ConsoleGenerations.tsx', import.meta.url), 'utf8');
  const gallery = readFileSync(new URL('../pages/Gallery.tsx', import.meta.url), 'utf8');

  assert.match(historyStream, /CopyPromptButton/);
  assert.match(consoleGenerations, /CopyPromptButton/);
  assert.match(gallery, /CopyPromptButton/);
});
