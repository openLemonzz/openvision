import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  resolveProgressiveImageAttributes,
  resolveProgressiveImageFrameStyle,
} from './progressive-image.ts';

test('share images load eagerly with high network priority', () => {
  assert.deepEqual(resolveProgressiveImageAttributes('high'), {
    decoding: 'async',
    fetchPriority: 'high',
    loading: 'eager',
  });
});

test('gallery and history images load lazily with low network priority', () => {
  assert.deepEqual(resolveProgressiveImageAttributes('lazy'), {
    decoding: 'async',
    fetchPriority: 'low',
    loading: 'lazy',
  });
});

test('progressive image frame preserves known aspect ratios and viewport-bounds share images', () => {
  assert.deepEqual(resolveProgressiveImageFrameStyle('9:16', '90vh'), {
    aspectRatio: '9 / 16',
    width: 'min(100%, calc(90vh * 0.5625))',
  });
  assert.deepEqual(resolveProgressiveImageFrameStyle('16:9'), {
    aspectRatio: '16 / 9',
  });
  assert.deepEqual(resolveProgressiveImageFrameStyle('unknown'), {
    aspectRatio: '1 / 1',
  });
});

test('share and collection views render through ProgressiveImage', () => {
  const shareSource = readFileSync(new URL('../pages/ShareView.tsx', import.meta.url), 'utf8');
  const gallerySource = readFileSync(new URL('../pages/Gallery.tsx', import.meta.url), 'utf8');
  const historySource = readFileSync(new URL('../components/HistoryStream.tsx', import.meta.url), 'utf8');
  const lightboxSource = readFileSync(new URL('../components/ui/Lightbox.tsx', import.meta.url), 'utf8');

  assert.match(shareSource, /<ProgressiveImage[\s\S]*priority="high"/);
  assert.match(gallerySource, /<ProgressiveImage[\s\S]*priority="lazy"/);
  assert.match(historySource, /<ProgressiveImage[\s\S]*priority="lazy"/);
  assert.match(lightboxSource, /resolveProgressiveImageAttributes\('high'\)/);
});
