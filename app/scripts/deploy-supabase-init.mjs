#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const REQUIRED_ENV_VARS = [
  'SUPABASE_ACCESS_TOKEN',
  'PROJECT_REF',
  'SUPABASE_DB_PASSWORD',
];

const FUNCTIONS_DEPLOY_ARGS = [
  'functions',
  'deploy',
  '--project-ref',
  '{PROJECT_REF}',
  '--use-api',
];

export function getMissingEnvVars(env = process.env) {
  return REQUIRED_ENV_VARS.filter((name) => !env[name]?.trim());
}

export function getAppDir(metaUrl = import.meta.url) {
  const scriptDir = path.dirname(fileURLToPath(metaUrl));
  return path.resolve(scriptDir, '..');
}

export function getSupabaseDir(appDir) {
  return path.join(appDir, 'supabase');
}

export function buildSupabaseCommandArgs(projectRef) {
  return [
    ['--yes', 'link', '--project-ref', projectRef],
    ['--yes', 'db', 'push', '--linked', '--include-all'],
    ['--yes', 'seed', 'buckets', '--linked'],
    FUNCTIONS_DEPLOY_ARGS.map((arg) => arg.replace('{PROJECT_REF}', projectRef)),
  ];
}

function assertProjectStructure(appDir) {
  const supabaseDir = getSupabaseDir(appDir);
  const requiredPaths = [
    path.join(supabaseDir, 'config.toml'),
    path.join(supabaseDir, 'migrations'),
    path.join(supabaseDir, 'functions'),
  ];

  const missingPaths = requiredPaths.filter((target) => !existsSync(target));
  if (missingPaths.length > 0) {
    throw new Error(`Missing Supabase project files: ${missingPaths.join(', ')}`);
  }
}

function runCommand(command, args, cwd, env) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const rendered = [command, ...args].join(' ');
    throw new Error(`Command failed: ${rendered}`);
  }
}

export function runInitialization({
  env = process.env,
  cwd = getAppDir(),
  runner = runCommand,
} = {}) {
  const missingEnvVars = getMissingEnvVars(env);
  if (missingEnvVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingEnvVars.join(', ')}`
    );
  }

  assertProjectStructure(cwd);

  for (const args of buildSupabaseCommandArgs(env.PROJECT_REF.trim())) {
    runner('supabase', args, cwd, env);
  }
}

function main() {
  try {
    runInitialization();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
