import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import {
  buildSupabaseCommandArgs,
  getAppDir,
  getMissingEnvVars,
  getSupabaseDir,
  runInitialization,
} from './deploy-supabase-init.mjs';

test('getMissingEnvVars returns every missing deployment variable', () => {
  const missing = getMissingEnvVars({
    SUPABASE_ACCESS_TOKEN: '',
    PROJECT_REF: 'vision-ref',
    SUPABASE_DB_PASSWORD: '',
  });

  assert.deepEqual(missing, ['SUPABASE_ACCESS_TOKEN', 'SUPABASE_DB_PASSWORD']);
});

test('buildSupabaseCommandArgs creates the first deploy sequence', () => {
  assert.deepEqual(buildSupabaseCommandArgs('duriyvscfdutnqzkyppp'), [
    ['--yes', 'link', '--project-ref', 'duriyvscfdutnqzkyppp'],
    ['--yes', 'db', 'push', '--linked', '--include-all'],
    ['--yes', 'seed', 'buckets', '--linked'],
    [
      'functions',
      'deploy',
      '--project-ref',
      'duriyvscfdutnqzkyppp',
      '--use-api',
    ],
  ]);
});

test('runInitialization invokes commands in app root', () => {
  const calls = [];
  const cwd = getAppDir();

  runInitialization({
    cwd,
    env: {
      SUPABASE_ACCESS_TOKEN: 'token',
      PROJECT_REF: 'duriyvscfdutnqzkyppp',
      SUPABASE_DB_PASSWORD: 'password',
    },
    runner: (command, args, runnerCwd) => {
      calls.push([command, args, runnerCwd]);
    },
  });

  assert.equal(calls.length, 4);
  assert.equal(calls[0][0], 'supabase');
  assert.equal(calls[0][2], cwd);
  assert.equal(getSupabaseDir(cwd), path.join(cwd, 'supabase'));
});
