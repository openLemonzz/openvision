import test from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveAuthEmailRedirectUrl,
  resolveAuthRedirectOrigin,
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

test('configured public web origin overrides browser origin for email confirmation', () => {
  const redirectOrigin = resolveAuthRedirectOrigin({
    configuredOrigin: 'https://vision.example.com/welcome?from=email',
    currentOrigin: 'http://localhost:3000',
  });

  const options = buildRegisterSignUpOptions({
    username: 'demo',
    inviteCode: 'ABCD-1234',
    origin: redirectOrigin,
  });

  assert.equal(redirectOrigin, 'https://vision.example.com');
  assert.equal(options.emailRedirectTo, 'https://vision.example.com/');
});

test('invalid configured public web origin falls back to the current browser origin', () => {
  const redirectOrigin = resolveAuthRedirectOrigin({
    configuredOrigin: 'not-a-url',
    currentOrigin: 'https://app.example.com',
  });

  assert.equal(redirectOrigin, 'https://app.example.com');
});

test('settings api response overrides browser origin for auth redirects', async () => {
  const redirectUrl = await resolveAuthEmailRedirectUrl({
    currentOrigin: 'http://localhost:3000',
    settingsApiUrl: 'https://admin.example.com/api/settings/public',
    fetchImpl: async (input) => {
      assert.equal(String(input), 'https://admin.example.com/api/settings/public');
      return new Response(JSON.stringify({ publicWebUrl: 'https://vision.example.com/path?ignored=1' }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    },
  });

  assert.equal(redirectUrl, 'https://vision.example.com/');
});

test('settings api failure falls back to the current browser origin for auth redirects', async () => {
  const redirectUrl = await resolveAuthEmailRedirectUrl({
    currentOrigin: 'https://app.example.com',
    settingsApiUrl: 'https://admin.example.com/api/settings/public',
    fetchImpl: async () => {
      throw new Error('network failed');
    },
  });

  assert.equal(redirectUrl, 'https://app.example.com/');
});

test('invalid settings api payload falls back to the current browser origin for auth redirects', async () => {
  const redirectUrl = await resolveAuthEmailRedirectUrl({
    currentOrigin: 'https://app.example.com',
    settingsApiUrl: 'https://admin.example.com/api/settings/public',
    fetchImpl: async () => new Response(JSON.stringify({ publicWebUrl: 'not-a-url' }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    }),
  });

  assert.equal(redirectUrl, 'https://app.example.com/');
});
