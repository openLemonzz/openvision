import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildRegisterSignUpOptions,
  resolveRegisterResult,
} from './auth-registration.ts';

test('duplicate signup hidden behind a null session still returns an error state', () => {
  const result = resolveRegisterResult({
    data: {
      session: null,
      user: {
        identities: [],
      },
    },
    error: null,
  });

  assert.equal(result.kind, 'error');
  assert.equal(result.errorMessage, '该邮箱已被注册，请直接登录');
});

test('fresh signup without a session asks the user to confirm their email', () => {
  const result = resolveRegisterResult({
    data: {
      session: null,
      user: {
        identities: [{}],
      },
    },
    error: null,
  });

  assert.equal(result.kind, 'confirmation');
  assert.match(result.confirmationMessage ?? '', /确认邮件/);
});

test('signup api errors are translated to the existing chinese messages', () => {
  const result = resolveRegisterResult({
    data: {
      session: null,
      user: null,
    },
    error: {
      message: 'User already registered',
    },
  });

  assert.equal(result.kind, 'error');
  assert.equal(result.errorMessage, '该邮箱已被注册，请直接登录');
});

test('register signup options use the current site origin for email confirmation', () => {
  const options = buildRegisterSignUpOptions({
    username: 'demo',
    inviteCode: 'ABCD-1234',
    origin: 'https://vision.example.com',
  });

  assert.deepEqual(options, {
    data: {
      username: 'demo',
      invite_code: 'ABCD-1234',
    },
    emailRedirectTo: 'https://vision.example.com/',
  });
});
