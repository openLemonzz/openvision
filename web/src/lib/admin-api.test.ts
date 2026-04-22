import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAdminApiUrl,
  createAdminHeaders,
} from './admin-api.ts';

test('buildAdminApiUrl trims the base slash and joins relative paths', () => {
  assert.equal(
    buildAdminApiUrl('/public/models', 'http://localhost:8787/api/'),
    'http://localhost:8787/api/public/models'
  );
});

test('buildAdminApiUrl rejects missing admin api base url', () => {
  assert.throws(() => buildAdminApiUrl('/public/models', ''), /VITE_ADMIN_API_URL/);
});

test('createAdminHeaders sets json content type and bearer token for request bodies', () => {
  const headers = createAdminHeaders(
    {
      body: JSON.stringify({ prompt: 'demo' }),
    },
    'token-123'
  );

  assert.equal(headers.get('Content-Type'), 'application/json');
  assert.equal(headers.get('Authorization'), 'Bearer token-123');
});
