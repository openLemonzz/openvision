import test from 'node:test';
import assert from 'node:assert/strict';

import { shouldCloseAuthModalFromClick } from './auth-modal-backdrop.ts';

test('closes only when the backdrop itself is clicked', () => {
  const backdrop = { id: 'backdrop' };
  const content = { id: 'content' };

  assert.equal(shouldCloseAuthModalFromClick(backdrop, backdrop), true);
  assert.equal(shouldCloseAuthModalFromClick(content, backdrop), false);
});
