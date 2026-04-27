import test from 'node:test';
import assert from 'node:assert/strict';

import { downloadImageFromUrl } from './image-actions.ts';

test('downloadImageFromUrl fetches the image as a blob before clicking a download link', async () => {
  const calls: string[] = [];
  const anchor = {
    href: '',
    download: '',
    rel: '',
    click: () => calls.push('click'),
  };

  const outcome = await downloadImageFromUrl('https://cdn.example.com/image.png', 'vision.png', {
    fetchImage: async (url) => {
      calls.push(`fetch:${url}`);
      return new Response(new Blob(['png-binary'], { type: 'image/png' }), { status: 200 });
    },
    createObjectUrl: (blob) => {
      calls.push(`object:${blob.type}`);
      return 'blob:https://app.example.com/download';
    },
    revokeObjectUrl: (url) => calls.push(`revoke:${url}`),
    createAnchor: () => anchor,
    appendAnchor: () => calls.push('append'),
    removeAnchor: () => calls.push('remove'),
    openUrl: () => calls.push('open'),
  });

  assert.equal(outcome, 'downloaded');
  assert.equal(anchor.href, 'blob:https://app.example.com/download');
  assert.equal(anchor.download, 'vision.png');
  assert.deepEqual(calls, [
    'fetch:https://cdn.example.com/image.png',
    'object:image/png',
    'append',
    'click',
    'remove',
    'revoke:blob:https://app.example.com/download',
  ]);
});

test('downloadImageFromUrl opens the original image when blob download is blocked', async () => {
  const calls: string[] = [];

  const outcome = await downloadImageFromUrl('https://cdn.example.com/image.png', 'vision.png', {
    fetchImage: async () => {
      throw new TypeError('CORS blocked');
    },
    createObjectUrl: () => {
      throw new Error('should not create object url');
    },
    revokeObjectUrl: () => calls.push('revoke'),
    createAnchor: () => {
      throw new Error('should not create anchor');
    },
    appendAnchor: () => calls.push('append'),
    removeAnchor: () => calls.push('remove'),
    openUrl: (url) => calls.push(`open:${url}`),
  });

  assert.equal(outcome, 'opened');
  assert.deepEqual(calls, ['open:https://cdn.example.com/image.png']);
});
