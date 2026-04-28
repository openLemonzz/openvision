import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildPublicSharePath,
  buildSharePageUrl,
  buildWorkshopRetryPath,
  resolveInviteCodeFromLocation,
} from './share-links.ts';

test('buildPublicSharePath encodes share codes for the admin API route', () => {
  assert.equal(buildPublicSharePath('ABC 123/xyz'), '/public/shares/ABC%20123%2Fxyz');
});

test('buildSharePageUrl creates browser-facing share urls from the current origin', () => {
  assert.equal(buildSharePageUrl('https://vision.example.com/', 'ABC 123'), 'https://vision.example.com/#/s/ABC%20123');
});

test('buildWorkshopRetryPath carries creator invite code into registration flow', () => {
  assert.equal(buildWorkshopRetryPath('INVITE 88'), '/?invite=INVITE%2088');
  assert.equal(buildWorkshopRetryPath(null), '/');
});

test('resolveInviteCodeFromLocation reads invite codes from normal and hash router queries', () => {
  assert.equal(resolveInviteCodeFromLocation({ search: '?invite=INVITE88', hash: '' }), 'INVITE88');
  assert.equal(resolveInviteCodeFromLocation({ search: '', hash: '#/?invite=SHARE88' }), 'SHARE88');
  assert.equal(resolveInviteCodeFromLocation({ search: '', hash: '#/s/abc' }), '');
});
