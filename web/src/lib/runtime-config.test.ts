import test from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluateInitializationReadiness,
  resolveRuntimeConfig,
} from './runtime-config.ts';

test('docker runtime with missing env enters config-missing state', () => {
  const config = resolveRuntimeConfig({
    envConfig: {},
    runtimeConfig: {
      runtime: 'docker',
      VITE_SUPABASE_URL: '',
      VITE_SUPABASE_ANON_KEY: '',
      VITE_ADMIN_API_URL: '',
    },
  });

  assert.equal(config.runtime, 'docker');
  assert.equal(config.gate.kind, 'config-missing');
  assert.deepEqual(config.gate.missingKeys, [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'VITE_ADMIN_API_URL',
  ]);
});

test('docker runtime with env present requires backend readiness check', () => {
  const config = resolveRuntimeConfig({
    envConfig: {},
    runtimeConfig: {
      runtime: 'docker',
      VITE_SUPABASE_URL: 'https://demo.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'anon-key',
      VITE_ADMIN_API_URL: 'http://localhost:8787/api',
    },
  });

  assert.equal(config.gate.kind, 'check-required');
  assert.equal(config.supabaseUrl, 'https://demo.supabase.co');
  assert.equal(config.supabaseAnonKey, 'anon-key');
  assert.equal(config.adminApiUrl, 'http://localhost:8787/api');
  assert.equal('webOrigin' in config, false);
});

test('local runtime without Supabase config enters config-missing state', () => {
  const config = resolveRuntimeConfig({
    envConfig: {},
    runtimeConfig: {},
  });

  assert.equal(config.runtime, 'local');
  assert.equal(config.gate.kind, 'config-missing');
  assert.equal(config.supabaseEnabled, false);
  assert.deepEqual(config.gate.missingKeys, [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'VITE_ADMIN_API_URL',
  ]);
});

test('admin health payload with missing resources returns backend-uninitialized state', () => {
  const readiness = evaluateInitializationReadiness({
    health: {
      reachable: true,
      status: 200,
      payload: {
        ok: false,
        missing: ['SUPABASE_SERVICE_ROLE_KEY'],
      },
    },
  });

  assert.equal(readiness.kind, 'backend-uninitialized');
  assert.deepEqual(readiness.missingResources, ['SUPABASE_SERVICE_ROLE_KEY']);
});

test('unreachable admin health returns network-error state', () => {
  const readiness = evaluateInitializationReadiness({
    health: {
      reachable: false,
      status: 0,
      payload: null,
    },
  });

  assert.equal(readiness.kind, 'network-error');
});

test('healthy admin payload returns ready state', () => {
  const readiness = evaluateInitializationReadiness({
    health: {
      reachable: true,
      status: 200,
      payload: {
        ok: true,
        missing: [],
      },
    },
  });

  assert.equal(readiness.kind, 'ready');
});
