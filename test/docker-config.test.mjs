import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = '/Users/caomei/Downloads/vision';

function read(path) {
  return readFileSync(join(repoRoot, path), 'utf8');
}

function extractWebPublishedPort(composeContent) {
  const match = composeContent.match(/^\s*-\s+"(\d+):(\d+)"\s*$/m);
  assert.ok(match, 'web port mapping not found in docker-compose.yml');
  return {
    published: match[1],
    target: match[2],
  };
}

function extractEnvValue(envContent, key) {
  const match = envContent.match(new RegExp(`^${key}=(.+)$`, 'm'));
  assert.ok(match, `missing ${key} in env file`);
  return match[1].trim();
}

test('docker web port is aligned to the documented local origin', () => {
  const composeContent = read('docker-compose.yml');
  const adminEnvContent = read('admin/.env');

  const webPort = extractWebPublishedPort(composeContent);
  const webOrigin = extractEnvValue(adminEnvContent, 'WEB_ORIGIN');
  const webOriginPort = new URL(webOrigin).port;

  assert.equal(webPort.published, '9901');
  assert.equal(webPort.target, '9901');
  assert.equal(webPort.published, webOriginPort);
});
