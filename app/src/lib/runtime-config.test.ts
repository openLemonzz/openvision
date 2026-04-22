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
    },
  });

  assert.equal(config.runtime, 'docker');
  assert.equal(config.gate.kind, 'config-missing');
  assert.deepEqual(config.gate.missingKeys, [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
  ]);
});

test('docker runtime with env present requires backend readiness check', () => {
  const config = resolveRuntimeConfig({
    envConfig: {},
    runtimeConfig: {
      runtime: 'docker',
      VITE_SUPABASE_URL: 'https://demo.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'anon-key',
    },
  });

  assert.equal(config.gate.kind, 'check-required');
  assert.equal(config.supabaseUrl, 'https://demo.supabase.co');
  assert.equal(config.supabaseAnonKey, 'anon-key');
});

test('local runtime without Supabase config still allows local fallback', () => {
  const config = resolveRuntimeConfig({
    envConfig: {},
    runtimeConfig: {},
  });

  assert.equal(config.runtime, 'local');
  assert.equal(config.gate.kind, 'local-fallback');
  assert.equal(config.supabaseEnabled, false);
});

test('missing function probes return functions-missing state', () => {
  const readiness = evaluateInitializationReadiness({
    health: {
      reachable: true,
      status: 200,
      payload: {
        ready: true,
        missingResources: [],
        message: 'ready',
      },
    },
    functionProbes: [
      { name: 'check-email', status: 204 },
      { name: 'admin-users', status: 404 },
      { name: 'generate-image', status: 204 },
    ],
  });

  assert.equal(readiness.kind, 'functions-missing');
  assert.deepEqual(readiness.missingFunctions, ['admin-users']);
});

test('health payload with missing resources returns backend-uninitialized state', () => {
  const readiness = evaluateInitializationReadiness({
    health: {
      reachable: true,
      status: 200,
      payload: {
        ready: false,
        missingResources: ['table:generations', 'bucket:images'],
        message: 'backend is not initialized',
      },
    },
    functionProbes: [
      { name: 'check-email', status: 204 },
      { name: 'admin-users', status: 204 },
      { name: 'generate-image', status: 204 },
    ],
  });

  assert.equal(readiness.kind, 'backend-uninitialized');
  assert.deepEqual(readiness.missingResources, [
    'table:generations',
    'bucket:images',
  ]);
});

test('unreachable function probe returns network-error state', () => {
  const readiness = evaluateInitializationReadiness({
    health: {
      reachable: true,
      status: 200,
      payload: {
        ready: true,
        missingResources: [],
        message: 'ready',
      },
    },
    functionProbes: [
      { name: 'check-email', status: 0 },
      { name: 'admin-users', status: 204 },
      { name: 'generate-image', status: 204 },
    ],
  });

  assert.equal(readiness.kind, 'network-error');
});

test('healthy payload with successful probes returns ready state', () => {
  const readiness = evaluateInitializationReadiness({
    health: {
      reachable: true,
      status: 200,
      payload: {
        ready: true,
        missingResources: [],
        message: 'ready',
      },
    },
    functionProbes: [
      { name: 'check-email', status: 204 },
      { name: 'admin-users', status: 204 },
      { name: 'generate-image', status: 204 },
    ],
  });

  assert.equal(readiness.kind, 'ready');
});
