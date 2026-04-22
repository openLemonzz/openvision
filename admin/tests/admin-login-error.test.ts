import assert from 'node:assert/strict';
import test from 'node:test';
import { getAdminLoginErrorMessage } from '../src/lib/admin-login-error';

test('maps invalid Supabase credentials to a password error message', () => {
  assert.equal(
    getAdminLoginErrorMessage({ message: 'Invalid login credentials' }),
    '邮箱或密码错误'
  );
});

test('keeps permission-denied messaging separate from auth failures', () => {
  assert.equal(
    getAdminLoginErrorMessage(new Error('Forbidden')),
    '登录失败：Forbidden'
  );
});
