import assert from 'node:assert/strict';
import test from 'node:test';
import type { AddressInfo } from 'node:net';

import { createApp, type ServerDependencies } from '../server/app.js';
import { encryptSecret } from '../server/crypto.js';

async function withTestServer(
  dependencies: ServerDependencies,
  run: (baseUrl: string) => Promise<void>
) {
  const app = createApp(dependencies);
  const server = app.listen(0, '127.0.0.1');

  try {
    await new Promise<void>((resolve) => {
      server.once('listening', () => resolve());
    });

    const address = server.address() as AddressInfo;
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
}

test('GET /api/me returns the authenticated user profile fields used by web', async () => {
  const dependencies: ServerDependencies = {
    resolveAuthUser: async (token) => token === 'user-token'
      ? { id: 'user-1', email: 'user@example.com' }
      : null,
    query: async (sql, params) => {
      if (sql.includes('from auth.users u') && sql.includes('left join public.profiles')) {
        assert.deepEqual(params, ['user-1', 'user-1']);
        return {
          rows: [{
            id: 'user-1',
            email: 'user@example.com',
            username: 'vision-user',
            invite_code: 'INVITE88',
            invite_count: 3,
            is_disabled: false,
            is_admin: true,
            concurrency_limit: 4,
          }],
          rowCount: 1,
        };
      }

      throw new Error(`Unexpected query: ${sql}`);
    },
  };

  await withTestServer(dependencies, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/me`, {
      headers: {
        Authorization: 'Bearer user-token',
      },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      id: 'user-1',
      email: 'user@example.com',
      username: 'vision-user',
      inviteCode: 'INVITE88',
      inviteCount: 3,
      isDisabled: false,
      isAdmin: true,
      concurrencyLimit: 4,
    });
  });
});

test('GET /api/me backfills a missing profile row for legacy users instead of returning 404', async () => {
  let selectCount = 0;
  const seenQueries: Array<{ sql: string; params: unknown[] | undefined }> = [];

  const dependencies: ServerDependencies = {
    resolveAuthUser: async () => ({ id: 'legacy-user', email: 'legacy@example.com' }),
    query: async (sql, params) => {
      seenQueries.push({ sql, params });

      if (sql.includes('from auth.users u') && sql.includes('left join public.profiles')) {
        selectCount += 1;
        if (selectCount === 1) {
          return { rows: [], rowCount: 0 };
        }

        return {
          rows: [{
            id: 'legacy-user',
            email: 'legacy@example.com',
            username: 'legacy',
            invite_code: 'LEGACY88',
            invite_count: 0,
            is_disabled: false,
            is_admin: false,
            concurrency_limit: 1,
          }],
          rowCount: 1,
        };
      }

      if (sql.includes('insert into public.profiles')) {
        assert.deepEqual(params, ['legacy-user', 'legacy']);
        return { rows: [], rowCount: 1 };
      }

      throw new Error(`Unexpected query: ${sql}`);
    },
  };

  await withTestServer(dependencies, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/me`, {
      headers: {
        Authorization: 'Bearer legacy-token',
      },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      id: 'legacy-user',
      email: 'legacy@example.com',
      username: 'legacy',
      inviteCode: 'LEGACY88',
      inviteCount: 0,
      isDisabled: false,
      isAdmin: false,
      concurrencyLimit: 1,
    });
  });

  assert.equal(selectCount, 2);
  assert.equal(seenQueries.some(({ sql }) => sql.includes('insert into public.profiles')), true);
});

test('GET /api/public/models returns enabled web-facing model metadata without secrets', async () => {
  const dependencies: ServerDependencies = {
    query: async (sql) => {
      if (sql.includes('from public.model_configs')) {
        return {
          rows: [{
            id: 'flux-1',
            name: 'Flux 1',
            provider: 'BFL',
            enabled: true,
            max_tokens: 2048,
            temperature: '0.8',
            default_size: '1024x1024',
            protocol: 'openai',
            api_endpoint: 'https://internal.example.com',
            api_key_ciphertext: 'secret',
          }],
          rowCount: 1,
        };
      }

      throw new Error(`Unexpected query: ${sql}`);
    },
  };

  await withTestServer(dependencies, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/public/models`);
    assert.equal(response.status, 200);

    assert.deepEqual(await response.json(), [{
      id: 'flux-1',
      name: 'Flux 1',
      provider: 'BFL',
      enabled: true,
      maxTokens: 2048,
      temperature: 0.8,
      defaultSize: '1024x1024',
      protocol: 'openai',
    }]);
  });
});

test('GET /api/settings/public returns only the public web url', async () => {
  const dependencies: ServerDependencies = {
    query: async (sql) => {
      if (sql.includes('from public.app_settings')) {
        return {
          rows: [{
            public_web_url: 'https://vision.app',
          }],
          rowCount: 1,
        };
      }

      throw new Error(`Unexpected query: ${sql}`);
    },
  };

  await withTestServer(dependencies, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/settings/public`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      publicWebUrl: 'https://vision.app',
    });
  });
});

test('PUT /api/settings normalizes and persists the public web url origin', async () => {
  const dependencies: ServerDependencies = {
    resolveAuthUser: async () => ({ id: 'admin-1', email: 'admin@example.com' }),
    query: async (sql, params) => {
      if (sql.includes('select 1 from public.admin_roles')) {
        assert.deepEqual(params, ['admin-1']);
        return { rows: [{ '?column?': 1 }], rowCount: 1 };
      }

      if (sql.includes('insert into public.app_settings')) {
        assert.deepEqual(params, ['default', 'https://vision.app']);
        return {
          rows: [{
            public_web_url: 'https://vision.app',
          }],
          rowCount: 1,
        };
      }

      throw new Error(`Unexpected query: ${sql}`);
    },
  };

  await withTestServer(dependencies, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/settings`, {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer admin-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        publicWebUrl: 'https://vision.app/welcome?from=email',
      }),
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      publicWebUrl: 'https://vision.app',
    });
  });
});

test('PUT /api/settings rejects invalid public web urls', async () => {
  const dependencies: ServerDependencies = {
    resolveAuthUser: async () => ({ id: 'admin-1', email: 'admin@example.com' }),
    query: async (sql, params) => {
      if (sql.includes('select 1 from public.admin_roles')) {
        assert.deepEqual(params, ['admin-1']);
        return { rows: [{ '?column?': 1 }], rowCount: 1 };
      }

      throw new Error(`Unexpected query: ${sql}`);
    },
  };

  await withTestServer(dependencies, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/settings`, {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer admin-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        publicWebUrl: 'not-a-url',
      }),
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: 'publicWebUrl must be an absolute http/https URL',
    });
  });
});

test('user generation APIs are scoped to the authenticated user', async () => {
  const seenQueries: Array<{ sql: string; params: unknown[] | undefined }> = [];

  const dependencies: ServerDependencies = {
    resolveAuthUser: async () => ({ id: 'user-1', email: 'user@example.com' }),
    query: async (sql, params) => {
      seenQueries.push({ sql, params });

      if (sql.includes('from public.generations') && sql.includes('order by created_at desc')) {
        assert.deepEqual(params, ['user-1']);
        return {
          rows: [{
            id: 'gen-1',
            generation_code: 'gen_1713873600000_ab12cd',
            picture_id: 'pic-1',
            prompt: 'A lighthouse in fog',
            aspect_ratio: '1:1',
            style_strength: 75,
            engine: 'flux-1',
            image_url: 'https://cdn.example.com/pic-1.png',
            created_at: '2026-04-22T12:00:00.000Z',
            picture_expires_at: null,
            picture_lifecycle: 'active',
            status: 'completed',
            error_message: 'Upstream failed: 502',
            error_details: 'provider returned 502',
            is_favorite: false,
            user_id: 'user-1',
          }],
          rowCount: 1,
        };
      }

      if (sql.includes('update public.generations') && sql.includes('set is_favorite = $3')) {
        assert.deepEqual(params, ['gen-1', 'user-1', true]);
        return {
          rows: [{
            id: 'gen-1',
            is_favorite: true,
          }],
          rowCount: 1,
        };
      }

      if (sql.includes('delete from public.generations')) {
        assert.deepEqual(params, ['gen-1', 'user-1']);
        return { rows: [], rowCount: 1 };
      }

      throw new Error(`Unexpected query: ${sql}`);
    },
  };

  await withTestServer(dependencies, async (baseUrl) => {
    const headers = { Authorization: 'Bearer user-token', 'Content-Type': 'application/json' };

    const listResponse = await fetch(`${baseUrl}/api/my/generations`, { headers });
    assert.equal(listResponse.status, 200);
    assert.deepEqual(await listResponse.json(), [{
      id: 'gen-1',
      generationCode: 'gen_1713873600000_ab12cd',
      pictureId: 'pic-1',
      prompt: 'A lighthouse in fog',
      aspectRatio: '1:1',
      styleStrength: 75,
      engine: 'flux-1',
      imageUrl: 'https://cdn.example.com/pic-1.png',
      createdAt: new Date('2026-04-22T12:00:00.000Z').getTime(),
      expiresAt: null,
      lifecycle: 'active',
      status: 'completed',
      isFavorite: false,
      userId: 'user-1',
    }]);

    const favoriteResponse = await fetch(`${baseUrl}/api/my/generations/gen-1/favorite`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ isFavorite: true }),
    });
    assert.equal(favoriteResponse.status, 200);
    assert.deepEqual(await favoriteResponse.json(), { id: 'gen-1', isFavorite: true });

    const deleteResponse = await fetch(`${baseUrl}/api/my/generations/gen-1`, {
      method: 'DELETE',
      headers,
    });
    assert.equal(deleteResponse.status, 204);
    assert.equal(await deleteResponse.text(), '');
  });

  assert.equal(seenQueries.length, 3);
});

test('GET /api/my/generation-capacity returns backend-authoritative capacity state', async () => {
  const dependencies: ServerDependencies = {
    resolveAuthUser: async () => ({ id: 'busy-user', email: 'busy@example.com' }),
    query: async (sql, params) => {
      if (sql.includes('select is_disabled') && sql.includes('concurrency_limit')) {
        assert.deepEqual(params, ['busy-user']);
        return {
          rows: [{ is_disabled: false, concurrency_limit: 2 }],
          rowCount: 1,
        };
      }

      if (sql.includes('count(*)::int as active_generation_count')) {
        assert.deepEqual(params, ['busy-user']);
        return {
          rows: [{ active_generation_count: 2 }],
          rowCount: 1,
        };
      }

      throw new Error(`Unexpected query: ${sql}`);
    },
  };

  await withTestServer(dependencies, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/my/generation-capacity`, {
      headers: {
        Authorization: 'Bearer busy-token',
      },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      concurrencyLimit: 2,
      activeGenerationCount: 2,
      canGenerate: false,
      reason: 'concurrency_limit_reached',
    });
  });
});

test('GET /api/generations includes admin-only generation diagnostics', async () => {
  const dependencies: ServerDependencies = {
    resolveAuthUser: async () => ({ id: 'admin-1', email: 'admin@example.com' }),
    query: async (sql, params) => {
      if (sql.includes('select 1 from public.admin_roles')) {
        assert.deepEqual(params, ['admin-1']);
        return { rows: [{ '?column?': 1 }], rowCount: 1 };
      }

      if (sql.includes('from public.generations') && sql.includes('order by created_at desc')) {
        return {
          rows: [{
            id: 'gen-failed-1',
            generation_code: 'gen_1713877200000_ef34gh',
            picture_id: null,
            prompt: 'Broken request',
            aspect_ratio: '16:9',
            style_strength: 60,
            engine: 'flux-1',
            image_url: '',
            created_at: '2026-04-22T13:00:00.000Z',
            picture_expires_at: null,
            picture_lifecycle: 'expired',
            status: 'failed',
            error_message: 'Upstream failed: 502',
            error_details: 'provider returned 502 bad gateway',
            is_favorite: false,
            user_id: 'user-9',
          }],
          rowCount: 1,
        };
      }

      throw new Error(`Unexpected query: ${sql}`);
    },
  };

  await withTestServer(dependencies, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/generations`, {
      headers: {
        Authorization: 'Bearer admin-token',
      },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), [{
      id: 'gen-failed-1',
      generationCode: 'gen_1713877200000_ef34gh',
      pictureId: null,
      prompt: 'Broken request',
      aspectRatio: '16:9',
      styleStrength: 60,
      engine: 'flux-1',
      imageUrl: '',
      createdAt: new Date('2026-04-22T13:00:00.000Z').getTime(),
      expiresAt: null,
      lifecycle: 'expired',
      status: 'failed',
      errorMessage: 'Upstream failed: 502',
      errorDetails: 'provider returned 502 bad gateway',
      isFavorite: false,
      userId: 'user-9',
    }]);
  });
});

test('POST /api/generate rejects disabled users before any upstream model call', async () => {
  let fetchCalled = false;

  const dependencies: ServerDependencies = {
    resolveAuthUser: async () => ({ id: 'disabled-user', email: 'disabled@example.com' }),
    query: async (sql, params) => {
      if (sql.includes('select is_disabled') && sql.includes('concurrency_limit')) {
        assert.deepEqual(params, ['disabled-user']);
        return {
          rows: [{ is_disabled: true, concurrency_limit: 1 }],
          rowCount: 1,
        };
      }

      throw new Error(`Unexpected query: ${sql}`);
    },
    fetch: async () => {
      fetchCalled = true;
      throw new Error('fetch should not be called');
    },
  };

  await withTestServer(dependencies, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer disabled-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'test prompt',
        modelId: 'flux-1',
        aspectRatio: '1:1',
        styleStrength: 75,
      }),
    });

    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: 'User is disabled' });
  });

  assert.equal(fetchCalled, false);
});

test('POST /api/generate rejects users that already reached the concurrency limit', async () => {
  let fetchCalled = false;

  const dependencies: ServerDependencies = {
    resolveAuthUser: async () => ({ id: 'busy-user', email: 'busy@example.com' }),
    query: async (sql, params) => {
      if (sql.includes('select is_disabled') && sql.includes('concurrency_limit')) {
        assert.deepEqual(params, ['busy-user']);
        return {
          rows: [{ is_disabled: false, concurrency_limit: 2 }],
          rowCount: 1,
        };
      }

      if (sql.includes('count(*)::int as active_generation_count')) {
        assert.deepEqual(params, ['busy-user']);
        return {
          rows: [{ active_generation_count: 2 }],
          rowCount: 1,
        };
      }

      throw new Error(`Unexpected query: ${sql}`);
    },
    fetch: async () => {
      fetchCalled = true;
      throw new Error('fetch should not be called');
    },
  };

  await withTestServer(dependencies, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer busy-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'test prompt',
        modelId: 'flux-1',
        aspectRatio: '1:1',
        styleStrength: 75,
      }),
    });

    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), { error: 'Concurrency limit reached' });
  });

  assert.equal(fetchCalled, false);
});

test('POST /api/generate creates and returns a business generation code while keeping id as the route identifier', async () => {
  const configCryptKey = 'fedcba9876543210fedcba9876543210';
  const apiKeyCiphertext = encryptSecret('provider-key', configCryptKey);
  let insertedGenerationCode: string | null = null;

  const dependencies: ServerDependencies = {
    configCryptKey,
    resolveAuthUser: async () => ({ id: 'user-3', email: 'user3@example.com' }),
    query: async (sql, params) => {
      if (sql.includes('select is_disabled') && sql.includes('concurrency_limit')) {
        assert.deepEqual(params, ['user-3']);
        return {
          rows: [{ is_disabled: false, concurrency_limit: 1 }],
          rowCount: 1,
        };
      }

      if (sql.includes('count(*)::int as active_generation_count')) {
        assert.deepEqual(params, ['user-3']);
        return {
          rows: [{ active_generation_count: 0 }],
          rowCount: 1,
        };
      }

      if (sql.includes('from public.model_configs')) {
        assert.deepEqual(params, ['flux-1']);
        return {
          rows: [{
            id: 'flux-1',
            enabled: true,
            protocol: 'openai',
            api_endpoint: 'https://provider.example.com/v1/images/generations',
            api_key_ciphertext: apiKeyCiphertext,
          }],
          rowCount: 1,
        };
      }

      if (sql.includes('insert into public.generations')) {
        assert.equal(params?.length, 6);
        assert.deepEqual(params?.slice(0, 5), ['user-3', 'test prompt', '1:1', 75, 'flux-1']);
        assert.match(String(params?.[5]), /^gen_\d{13}_[a-z0-9]{6}$/);
        insertedGenerationCode = String(params?.[5]);
        return {
          rows: [{ id: 'generation-uuid-1' }],
          rowCount: 1,
        };
      }

      if (sql.includes('set status = \'generating\'')) {
        assert.deepEqual(params, ['generation-uuid-1', 'user-3']);
        return { rows: [], rowCount: 1 };
      }

      if (sql.includes('set status = \'completed\'')) {
        assert.deepEqual(params?.slice(0, 4), [
          'generation-uuid-1',
          'user-3',
          'https://cdn.example.com/user-3/img_1713873600000_abga0o.png',
          'img_1713873600000_abga0o',
        ]);
        assert.match(String(params?.[4]), /^\d{4}-\d{2}-\d{2}T/);
        return { rows: [], rowCount: 1 };
      }

      throw new Error(`Unexpected query: ${sql}`);
    },
    fetch: async (input) => {
      assert.equal(input, 'https://provider.example.com/v1/images/generations');
      return new Response(JSON.stringify({
        data: [{ b64_json: Buffer.from('png-binary').toString('base64') }],
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    },
    getStorageClient: async () => ({
      storage: {
        from: (bucket: string) => {
          assert.equal(bucket, 'images');
          return {
            upload: async (filePath: string, body: Uint8Array, options: { contentType: string; upsert: boolean }) => {
              assert.equal(filePath, 'user-3/img_1713873600000_abga0o.png');
              assert.equal(body instanceof Uint8Array, true);
              assert.deepEqual(options, {
                contentType: 'image/png',
                upsert: true,
              });
              return { error: null };
            },
            getPublicUrl: (filePath: string) => {
              assert.equal(filePath, 'user-3/img_1713873600000_abga0o.png');
              return {
                data: {
                  publicUrl: 'https://cdn.example.com/user-3/img_1713873600000_abga0o.png',
                },
              };
            },
          };
        },
      },
    }) as Awaited<ReturnType<NonNullable<ServerDependencies['getStorageClient']>>>,
  };

  const originalDateNow = Date.now;
  const originalRandom = Math.random;
  Date.now = () => 1713873600000;
  Math.random = () => 0.2866143325;

  try {
    await withTestServer(dependencies, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer user-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: 'test prompt',
          modelId: 'flux-1',
          aspectRatio: '1:1',
          styleStrength: 75,
        }),
      });

      assert.equal(response.status, 200);
      const payload = await response.json();
      assert.deepEqual(payload, {
        id: 'generation-uuid-1',
        generationCode: insertedGenerationCode,
      });
      assert.match(String(payload.generationCode), /^gen_\d{13}_[a-z0-9]{6}$/);
    });
  } finally {
    Date.now = originalDateNow;
    Math.random = originalRandom;
  }

  assert.match(String(insertedGenerationCode), /^gen_\d{13}_[a-z0-9]{6}$/);
});

test('POST /api/generate switches to image-edit mode when a reference image is provided', async () => {
  const configCryptKey = '1234567890abcdef1234567890abcdef';
  const apiKeyCiphertext = encryptSecret('provider-key', configCryptKey);
  let upstreamRequestBody: Record<string, unknown> | null = null;

  const dependencies: ServerDependencies = {
    configCryptKey,
    resolveAuthUser: async () => ({ id: 'edit-user', email: 'edit@example.com' }),
    query: async (sql, params) => {
      if (sql.includes('select is_disabled') && sql.includes('concurrency_limit')) {
        assert.deepEqual(params, ['edit-user']);
        return {
          rows: [{ is_disabled: false, concurrency_limit: 1 }],
          rowCount: 1,
        };
      }

      if (sql.includes('count(*)::int as active_generation_count')) {
        assert.deepEqual(params, ['edit-user']);
        return {
          rows: [{ active_generation_count: 0 }],
          rowCount: 1,
        };
      }

      if (sql.includes('from public.model_configs')) {
        assert.deepEqual(params, ['gpt-image-2']);
        return {
          rows: [{
            id: 'gpt-image-2',
            enabled: true,
            protocol: 'openai',
            api_endpoint: 'https://provider.example.com/v1/images/generations',
            api_key_ciphertext: apiKeyCiphertext,
          }],
          rowCount: 1,
        };
      }

      if (sql.includes('insert into public.generations')) {
        return {
          rows: [{ id: 'gen-edit-1' }],
          rowCount: 1,
        };
      }

      if (sql.includes('set status = \'generating\'')) {
        assert.deepEqual(params, ['gen-edit-1', 'edit-user']);
        return { rows: [], rowCount: 1 };
      }

      if (sql.includes('set status = \'completed\'')) {
        assert.deepEqual(params?.slice(0, 2), ['gen-edit-1', 'edit-user']);
        assert.match(String(params?.[2]), /^https:\/\/cdn\.example\.com\/edit-user\/img_\d{13}_[a-z0-9]{6}\.png$/);
        assert.match(String(params?.[3]), /^img_\d{13}_[a-z0-9]{6}$/);
        assert.match(String(params?.[4]), /^\d{4}-\d{2}-\d{2}T/);
        return { rows: [], rowCount: 1 };
      }

      throw new Error(`Unexpected query: ${sql}`);
    },
    fetch: async (input, init) => {
      assert.equal(input, 'https://provider.example.com/v1/images/edits');
      upstreamRequestBody = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
      return new Response(JSON.stringify({
        data: [{ b64_json: Buffer.from('png-binary').toString('base64') }],
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    },
    getStorageClient: async () => ({
      storage: {
        from: (bucket: string) => {
          assert.equal(bucket, 'images');
          return {
            upload: async (filePath: string, body: Uint8Array, options: { contentType: string; upsert: boolean }) => {
              assert.match(filePath, /^edit-user\/img_\d{13}_[a-z0-9]{6}\.png$/);
              assert.equal(body instanceof Uint8Array, true);
              assert.deepEqual(options, {
                contentType: 'image/png',
                upsert: true,
              });
              return { error: null };
            },
            getPublicUrl: (filePath: string) => ({
              data: {
                publicUrl: `https://cdn.example.com/${filePath}`,
              },
            }),
          };
        },
      },
    }) as Awaited<ReturnType<NonNullable<ServerDependencies['getStorageClient']>>>,
  };

  await withTestServer(dependencies, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer user-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'edit this image',
        modelId: 'gpt-image-2',
        aspectRatio: '9:16',
        styleStrength: 75,
        referenceImageUrl: 'https://cdn.example.com/reference.png',
      }),
    });

    assert.equal(response.status, 200);
  });

  assert.deepEqual(upstreamRequestBody, {
    model: 'gpt-image-2',
    prompt: 'edit this image',
    n: 1,
    size: '1024x1536',
    images: [{ image_url: 'https://cdn.example.com/reference.png' }],
  });
});

test('POST /api/generate rejects edit mode for protocols without implemented reference-image support', async () => {
  const configCryptKey = 'abcdefabcdefabcdefabcdefabcdefab';
  const apiKeyCiphertext = encryptSecret('provider-key', configCryptKey);
  let fetchCalled = false;

  const dependencies: ServerDependencies = {
    configCryptKey,
    resolveAuthUser: async () => ({ id: 'stability-user', email: 'stability@example.com' }),
    query: async (sql, params) => {
      if (sql.includes('select is_disabled') && sql.includes('concurrency_limit')) {
        assert.deepEqual(params, ['stability-user']);
        return {
          rows: [{ is_disabled: false, concurrency_limit: 1 }],
          rowCount: 1,
        };
      }

      if (sql.includes('count(*)::int as active_generation_count')) {
        assert.deepEqual(params, ['stability-user']);
        return {
          rows: [{ active_generation_count: 0 }],
          rowCount: 1,
        };
      }

      if (sql.includes('from public.model_configs')) {
        assert.deepEqual(params, ['sdxl']);
        return {
          rows: [{
            id: 'sdxl',
            enabled: true,
            protocol: 'stability',
            api_endpoint: 'https://provider.example.com/v1/images/generations',
            api_key_ciphertext: apiKeyCiphertext,
          }],
          rowCount: 1,
        };
      }

      throw new Error(`Unexpected query: ${sql}`);
    },
    fetch: async () => {
      fetchCalled = true;
      throw new Error('fetch should not be called');
    },
  };

  await withTestServer(dependencies, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer user-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'edit this image',
        modelId: 'sdxl',
        aspectRatio: '1:1',
        styleStrength: 75,
        referenceImageUrl: 'https://cdn.example.com/reference.png',
      }),
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: 'Selected model does not support reference image edits',
    });
  });

  assert.equal(fetchCalled, false);
});

test('POST /api/generate stores upstream failure diagnostics on non-2xx responses', async () => {
  const configCryptKey = '0123456789abcdef0123456789abcdef';
  const apiKeyCiphertext = encryptSecret('provider-key', configCryptKey);
  let failedUpdateParams: unknown[] | undefined;

  const dependencies: ServerDependencies = {
    configCryptKey,
    resolveAuthUser: async () => ({ id: 'user-1', email: 'user@example.com' }),
    query: async (sql, params) => {
      if (sql.includes('select is_disabled') && sql.includes('concurrency_limit')) {
        assert.deepEqual(params, ['user-1']);
        return {
          rows: [{ is_disabled: false, concurrency_limit: 1 }],
          rowCount: 1,
        };
      }

      if (sql.includes('count(*)::int as active_generation_count')) {
        assert.deepEqual(params, ['user-1']);
        return {
          rows: [{ active_generation_count: 0 }],
          rowCount: 1,
        };
      }

      if (sql.includes('from public.model_configs')) {
        assert.deepEqual(params, ['flux-1']);
        return {
          rows: [{
            id: 'flux-1',
            enabled: true,
            protocol: 'openai',
            api_endpoint: 'https://provider.example.com/v1/images/generations',
            api_key_ciphertext: apiKeyCiphertext,
          }],
          rowCount: 1,
        };
      }

      if (sql.includes('insert into public.generations')) {
        return {
          rows: [{ id: 'gen-upstream-1' }],
          rowCount: 1,
        };
      }

      if (sql.includes('set status = \'generating\'')) {
        assert.deepEqual(params, ['gen-upstream-1', 'user-1']);
        return { rows: [], rowCount: 1 };
      }

      if (sql.includes('set status = \'failed\'')) {
        failedUpdateParams = params;
        assert.deepEqual(params, [
          'gen-upstream-1',
          'user-1',
          'Upstream failed: 502',
          'Upstream failed with status 502: bad gateway from provider',
        ]);
        return { rows: [], rowCount: 1 };
      }

      throw new Error(`Unexpected query: ${sql}`);
    },
    fetch: async () => new Response('bad gateway from provider', { status: 502 }),
  };

  await withTestServer(dependencies, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer user-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'test prompt',
        modelId: 'flux-1',
        aspectRatio: '1:1',
        styleStrength: 75,
      }),
    });

    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: 'Upstream failed: 502' });
  });

  assert.deepEqual(failedUpdateParams, [
    'gen-upstream-1',
    'user-1',
    'Upstream failed: 502',
    'Upstream failed with status 502: bad gateway from provider',
  ]);
});

test('POST /api/generate stores diagnostics when the provider response has no image payload', async () => {
  const configCryptKey = 'abcdef0123456789abcdef0123456789';
  const apiKeyCiphertext = encryptSecret('provider-key', configCryptKey);
  let failedUpdateParams: unknown[] | undefined;

  const dependencies: ServerDependencies = {
    configCryptKey,
    resolveAuthUser: async () => ({ id: 'user-2', email: 'user2@example.com' }),
    query: async (sql, params) => {
      if (sql.includes('select is_disabled') && sql.includes('concurrency_limit')) {
        assert.deepEqual(params, ['user-2']);
        return {
          rows: [{ is_disabled: false, concurrency_limit: 1 }],
          rowCount: 1,
        };
      }

      if (sql.includes('count(*)::int as active_generation_count')) {
        assert.deepEqual(params, ['user-2']);
        return {
          rows: [{ active_generation_count: 0 }],
          rowCount: 1,
        };
      }

      if (sql.includes('from public.model_configs')) {
        assert.deepEqual(params, ['flux-1']);
        return {
          rows: [{
            id: 'flux-1',
            enabled: true,
            protocol: 'openai',
            api_endpoint: 'https://provider.example.com/v1/images/generations',
            api_key_ciphertext: apiKeyCiphertext,
          }],
          rowCount: 1,
        };
      }

      if (sql.includes('insert into public.generations')) {
        return {
          rows: [{ id: 'gen-missing-image-1' }],
          rowCount: 1,
        };
      }

      if (sql.includes('set status = \'generating\'')) {
        assert.deepEqual(params, ['gen-missing-image-1', 'user-2']);
        return { rows: [], rowCount: 1 };
      }

      if (sql.includes('set status = \'failed\'')) {
        failedUpdateParams = params;
        assert.deepEqual(params, [
          'gen-missing-image-1',
          'user-2',
          'No image returned from provider',
          'Provider response did not contain an image URL or base64 payload',
        ]);
        return { rows: [], rowCount: 1 };
      }

      throw new Error(`Unexpected query: ${sql}`);
    },
    fetch: async () => new Response(JSON.stringify({ data: [{}] }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    }),
  };

  await withTestServer(dependencies, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer user-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'test prompt',
        modelId: 'flux-1',
        aspectRatio: '1:1',
        styleStrength: 75,
      }),
    });

    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: 'No image returned from provider' });
  });

  assert.deepEqual(failedUpdateParams, [
    'gen-missing-image-1',
    'user-2',
    'No image returned from provider',
    'Provider response did not contain an image URL or base64 payload',
  ]);
});

test('POST /api/generate times out slow upstream requests and stores timeout diagnostics', async () => {
  const configCryptKey = '00112233445566778899aabbccddeeff';
  const apiKeyCiphertext = encryptSecret('provider-key', configCryptKey);
  let failedUpdateParams: unknown[] | undefined;

  const dependencies = {
    configCryptKey,
    generationRequestTimeoutMs: 5,
    resolveAuthUser: async () => ({ id: 'timeout-user', email: 'timeout@example.com' }),
    query: async (sql: string, params: unknown[] | undefined) => {
      if (sql.includes('select is_disabled') && sql.includes('concurrency_limit')) {
        assert.deepEqual(params, ['timeout-user']);
        return {
          rows: [{ is_disabled: false, concurrency_limit: 1 }],
          rowCount: 1,
        };
      }

      if (sql.includes('count(*)::int as active_generation_count')) {
        assert.deepEqual(params, ['timeout-user']);
        return {
          rows: [{ active_generation_count: 0 }],
          rowCount: 1,
        };
      }

      if (sql.includes('from public.model_configs')) {
        assert.deepEqual(params, ['flux-1']);
        return {
          rows: [{
            id: 'flux-1',
            enabled: true,
            protocol: 'openai',
            api_endpoint: 'https://provider.example.com/v1/images/generations',
            api_key_ciphertext: apiKeyCiphertext,
          }],
          rowCount: 1,
        };
      }

      if (sql.includes('insert into public.generations')) {
        return {
          rows: [{ id: 'gen-timeout-1' }],
          rowCount: 1,
        };
      }

      if (sql.includes('set status = \'generating\'')) {
        assert.deepEqual(params, ['gen-timeout-1', 'timeout-user']);
        return { rows: [], rowCount: 1 };
      }

      if (sql.includes('set status = \'failed\'')) {
        failedUpdateParams = params;
        assert.deepEqual(params, [
          'gen-timeout-1',
          'timeout-user',
          'Upstream request timed out',
          'Upstream request to provider timed out after 5ms',
        ]);
        return { rows: [], rowCount: 1 };
      }

      throw new Error(`Unexpected query: ${sql}`);
    },
    fetch: async (_input: string | URL | Request, init?: RequestInit) => {
      const signal = init?.signal;
      if (!signal) {
        throw new Error('missing abort signal');
      }

      return await new Promise<Response>((_resolve, reject) => {
        if (signal.aborted) {
          reject(new DOMException('This operation was aborted', 'AbortError'));
          return;
        }

        signal.addEventListener('abort', () => {
          reject(new DOMException('This operation was aborted', 'AbortError'));
        }, { once: true });
      });
    },
  } as ServerDependencies;

  await withTestServer(dependencies, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer user-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'slow prompt',
        modelId: 'flux-1',
        aspectRatio: '1:1',
        styleStrength: 75,
      }),
    });

    assert.equal(response.status, 504);
    assert.deepEqual(await response.json(), { error: 'Upstream request timed out' });
  });

  assert.deepEqual(failedUpdateParams, [
    'gen-timeout-1',
    'timeout-user',
    'Upstream request timed out',
    'Upstream request to provider timed out after 5ms',
  ]);
});

test('POST /api/generate reuses provider auth for same-origin image downloads', async () => {
  const configCryptKey = '11223344556677889900aabbccddeeff';
  const apiKeyCiphertext = encryptSecret('provider-key', configCryptKey);
  const seenFetchCalls: Array<{ input: string | URL | Request; init?: RequestInit }> = [];

  const dependencies: ServerDependencies = {
    configCryptKey,
    resolveAuthUser: async () => ({ id: 'user-4', email: 'user4@example.com' }),
    query: async (sql, params) => {
      if (sql.includes('select is_disabled') && sql.includes('concurrency_limit')) {
        assert.deepEqual(params, ['user-4']);
        return {
          rows: [{ is_disabled: false, concurrency_limit: 1 }],
          rowCount: 1,
        };
      }

      if (sql.includes('count(*)::int as active_generation_count')) {
        assert.deepEqual(params, ['user-4']);
        return {
          rows: [{ active_generation_count: 0 }],
          rowCount: 1,
        };
      }

      if (sql.includes('from public.model_configs')) {
        assert.deepEqual(params, ['flux-1']);
        return {
          rows: [{
            id: 'flux-1',
            enabled: true,
            protocol: 'openai',
            api_endpoint: 'https://provider.example.com/v1/images/generations',
            api_key_ciphertext: apiKeyCiphertext,
          }],
          rowCount: 1,
        };
      }

      if (sql.includes('insert into public.generations')) {
        return {
          rows: [{ id: 'gen-download-auth-1' }],
          rowCount: 1,
        };
      }

      if (sql.includes('set status = \'generating\'')) {
        assert.deepEqual(params, ['gen-download-auth-1', 'user-4']);
        return { rows: [], rowCount: 1 };
      }

      if (sql.includes('set status = \'completed\'')) {
        assert.deepEqual(params?.slice(0, 2), ['gen-download-auth-1', 'user-4']);
        assert.match(String(params?.[2]), /^https:\/\/cdn\.example\.com\/user-4\/img_\d{13}_[a-z0-9]{6}\.png$/);
        assert.match(String(params?.[3]), /^img_\d{13}_[a-z0-9]{6}$/);
        assert.match(String(params?.[4]), /^\d{4}-\d{2}-\d{2}T/);
        return { rows: [], rowCount: 1 };
      }

      throw new Error(`Unexpected query: ${sql}`);
    },
    fetch: async (input, init) => {
      seenFetchCalls.push({ input, init });

      if (input === 'https://provider.example.com/v1/images/generations') {
        return new Response(JSON.stringify({
          data: [{ url: '/v1/files/generated-image.png' }],
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }

      if (input === 'https://provider.example.com/v1/files/generated-image.png') {
        const headers = new Headers(init?.headers);
        assert.equal(headers.get('Authorization'), 'Bearer provider-key');
        return new Response(Buffer.from('png-binary'), { status: 200 });
      }

      throw new Error(`Unexpected fetch input: ${String(input)}`);
    },
    getStorageClient: async () => ({
      storage: {
        from: (bucket: string) => {
          assert.equal(bucket, 'images');
          return {
            upload: async (filePath: string, body: Uint8Array, options: { contentType: string; upsert: boolean }) => {
              assert.match(filePath, /^user-4\/img_\d{13}_[a-z0-9]{6}\.png$/);
              assert.equal(body instanceof Uint8Array, true);
              assert.deepEqual(options, {
                contentType: 'image/png',
                upsert: true,
              });
              return { error: null };
            },
            getPublicUrl: (filePath: string) => {
              assert.match(filePath, /^user-4\/img_\d{13}_[a-z0-9]{6}\.png$/);
              return {
                data: {
                  publicUrl: `https://cdn.example.com/${filePath}`,
                },
              };
            },
          };
        },
      },
    }) as Awaited<ReturnType<NonNullable<ServerDependencies['getStorageClient']>>>,
  };

  await withTestServer(dependencies, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer user-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'same origin image',
        modelId: 'flux-1',
        aspectRatio: '1:1',
        styleStrength: 75,
      }),
    });

    assert.equal(response.status, 200);
    assert.equal(seenFetchCalls.length, 2);
    assert.equal(seenFetchCalls[1]?.input, 'https://provider.example.com/v1/files/generated-image.png');
  });
});

test('POST /api/generate retries a retryable generated-image download failure before succeeding', async () => {
  const configCryptKey = '5566778899aabbccddeeff0011223344';
  const apiKeyCiphertext = encryptSecret('provider-key', configCryptKey);
  let downloadAttempts = 0;
  let failedUpdateCalled = false;

  const dependencies: ServerDependencies = {
    configCryptKey,
    imageDownloadRetryCount: 1,
    imageDownloadRetryBaseDelayMs: 0,
    resolveAuthUser: async () => ({ id: 'retry-download-user', email: 'retry@example.com' }),
    query: async (sql, params) => {
      if (sql.includes('select is_disabled') && sql.includes('concurrency_limit')) {
        assert.deepEqual(params, ['retry-download-user']);
        return {
          rows: [{ is_disabled: false, concurrency_limit: 1 }],
          rowCount: 1,
        };
      }

      if (sql.includes('count(*)::int as active_generation_count')) {
        assert.deepEqual(params, ['retry-download-user']);
        return {
          rows: [{ active_generation_count: 0 }],
          rowCount: 1,
        };
      }

      if (sql.includes('from public.model_configs')) {
        assert.deepEqual(params, ['flux-1']);
        return {
          rows: [{
            id: 'flux-1',
            enabled: true,
            protocol: 'openai',
            api_endpoint: 'https://provider.example.com/v1/images/generations',
            api_key_ciphertext: apiKeyCiphertext,
          }],
          rowCount: 1,
        };
      }

      if (sql.includes('insert into public.generations')) {
        return {
          rows: [{ id: 'gen-download-retry-1' }],
          rowCount: 1,
        };
      }

      if (sql.includes('set status = \'generating\'')) {
        assert.deepEqual(params, ['gen-download-retry-1', 'retry-download-user']);
        return { rows: [], rowCount: 1 };
      }

      if (sql.includes('set status = \'completed\'')) {
        assert.deepEqual(params?.slice(0, 2), ['gen-download-retry-1', 'retry-download-user']);
        return { rows: [], rowCount: 1 };
      }

      if (sql.includes('set status = \'failed\'')) {
        failedUpdateCalled = true;
        throw new Error('generation should not be marked failed after a successful retry');
      }

      throw new Error(`Unexpected query: ${sql}`);
    },
    fetch: async (input) => {
      if (input === 'https://provider.example.com/v1/images/generations') {
        return new Response(JSON.stringify({
          data: [{ url: '/v1/files/retry-image.png' }],
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }

      if (input === 'https://provider.example.com/v1/files/retry-image.png') {
        downloadAttempts += 1;
        if (downloadAttempts === 1) {
          return new Response('temporary unavailable', { status: 503 });
        }

        return new Response(Buffer.from('png-binary'), { status: 200 });
      }

      throw new Error(`Unexpected fetch input: ${String(input)}`);
    },
    getStorageClient: async () => ({
      storage: {
        from: () => ({
          upload: async () => ({ error: null }),
          getPublicUrl: () => ({
            data: {
              publicUrl: 'https://cdn.example.com/retry-download-user/result.png',
            },
          }),
        }),
      },
    }) as Awaited<ReturnType<NonNullable<ServerDependencies['getStorageClient']>>>,
  };

  await withTestServer(dependencies, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer user-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'retry image download',
        modelId: 'flux-1',
        aspectRatio: '1:1',
        styleStrength: 75,
      }),
    });

    assert.equal(response.status, 200);
  });

  assert.equal(downloadAttempts, 2);
  assert.equal(failedUpdateCalled, false);
});

test('POST /api/generate retries a transient generated-image download network error before succeeding', async () => {
  const configCryptKey = '66778899aabbccddeeff001122334455';
  const apiKeyCiphertext = encryptSecret('provider-key', configCryptKey);
  let downloadAttempts = 0;

  const dependencies: ServerDependencies = {
    configCryptKey,
    imageDownloadRetryCount: 1,
    imageDownloadRetryBaseDelayMs: 0,
    resolveAuthUser: async () => ({ id: 'retry-network-user', email: 'retry-network@example.com' }),
    query: async (sql, params) => {
      if (sql.includes('select is_disabled') && sql.includes('concurrency_limit')) {
        assert.deepEqual(params, ['retry-network-user']);
        return {
          rows: [{ is_disabled: false, concurrency_limit: 1 }],
          rowCount: 1,
        };
      }

      if (sql.includes('count(*)::int as active_generation_count')) {
        assert.deepEqual(params, ['retry-network-user']);
        return {
          rows: [{ active_generation_count: 0 }],
          rowCount: 1,
        };
      }

      if (sql.includes('from public.model_configs')) {
        assert.deepEqual(params, ['flux-1']);
        return {
          rows: [{
            id: 'flux-1',
            enabled: true,
            protocol: 'openai',
            api_endpoint: 'https://provider.example.com/v1/images/generations',
            api_key_ciphertext: apiKeyCiphertext,
          }],
          rowCount: 1,
        };
      }

      if (sql.includes('insert into public.generations')) {
        return {
          rows: [{ id: 'gen-download-network-retry-1' }],
          rowCount: 1,
        };
      }

      if (sql.includes('set status = \'generating\'')) {
        assert.deepEqual(params, ['gen-download-network-retry-1', 'retry-network-user']);
        return { rows: [], rowCount: 1 };
      }

      if (sql.includes('set status = \'completed\'')) {
        assert.deepEqual(params?.slice(0, 2), ['gen-download-network-retry-1', 'retry-network-user']);
        return { rows: [], rowCount: 1 };
      }

      if (sql.includes('set status = \'failed\'')) {
        throw new Error('generation should not be marked failed after a successful retry');
      }

      throw new Error(`Unexpected query: ${sql}`);
    },
    fetch: async (input) => {
      if (input === 'https://provider.example.com/v1/images/generations') {
        return new Response(JSON.stringify({
          data: [{ url: '/v1/files/retry-network-image.png' }],
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }

      if (input === 'https://provider.example.com/v1/files/retry-network-image.png') {
        downloadAttempts += 1;
        if (downloadAttempts === 1) {
          throw new TypeError('fetch failed');
        }

        return new Response(Buffer.from('png-binary'), { status: 200 });
      }

      throw new Error(`Unexpected fetch input: ${String(input)}`);
    },
    getStorageClient: async () => ({
      storage: {
        from: () => ({
          upload: async () => ({ error: null }),
          getPublicUrl: () => ({
            data: {
              publicUrl: 'https://cdn.example.com/retry-network-user/result.png',
            },
          }),
        }),
      },
    }) as Awaited<ReturnType<NonNullable<ServerDependencies['getStorageClient']>>>,
  };

  await withTestServer(dependencies, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer user-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'retry network error',
        modelId: 'flux-1',
        aspectRatio: '1:1',
        styleStrength: 75,
      }),
    });

    assert.equal(response.status, 200);
  });

  assert.equal(downloadAttempts, 2);
});

test('DELETE /api/users/:id deletes another user for admins', async () => {
  const seenQueries: Array<{ sql: string; params: unknown[] | undefined }> = [];

  const dependencies: ServerDependencies = {
    resolveAuthUser: async () => ({ id: 'admin-1', email: 'admin@example.com' }),
    query: async (sql, params) => {
      seenQueries.push({ sql, params });

      if (sql.includes('select 1 from public.admin_roles')) {
        assert.deepEqual(params, ['admin-1']);
        return { rows: [{ '?column?': 1 }], rowCount: 1 };
      }

      if (sql.includes('from auth.users') && sql.includes('where id = $1')) {
        assert.deepEqual(params, ['user-2']);
        return {
          rows: [{ id: 'user-2' }],
          rowCount: 1,
        };
      }

      if (sql.includes(`select to_regclass('public.invites')`)) {
        return {
          rows: [{ has_invites: 'public.invites' }],
          rowCount: 1,
        };
      }

      if (sql.includes('delete from public.invites')) {
        assert.deepEqual(params, ['user-2']);
        return { rows: [], rowCount: 0 };
      }

      if (sql.includes('delete from auth.users')) {
        assert.deepEqual(params, ['user-2']);
        return { rows: [], rowCount: 1 };
      }

      throw new Error(`Unexpected query: ${sql}`);
    },
  };

  await withTestServer(dependencies, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/users/user-2`, {
      method: 'DELETE',
      headers: {
        Authorization: 'Bearer admin-token',
      },
    });

    assert.equal(response.status, 204);
    assert.equal(await response.text(), '');
  });

  assert.equal(seenQueries.some(({ sql }) => sql.includes('delete from auth.users')), true);
});

test('DELETE /api/users/:id rejects self-deletion for admins', async () => {
  let queryCount = 0;

  const dependencies: ServerDependencies = {
    resolveAuthUser: async () => ({ id: 'admin-1', email: 'admin@example.com' }),
    query: async (sql, params) => {
      queryCount += 1;

      if (sql.includes('select 1 from public.admin_roles')) {
        assert.deepEqual(params, ['admin-1']);
        return { rows: [{ '?column?': 1 }], rowCount: 1 };
      }

      throw new Error(`Unexpected query: ${sql}`);
    },
  };

  await withTestServer(dependencies, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/users/admin-1`, {
      method: 'DELETE',
      headers: {
        Authorization: 'Bearer admin-token',
      },
    });

    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: 'Forbidden' });
  });

  assert.equal(queryCount, 1);
});

test('DELETE /api/users/:id returns 404 when the target user does not exist', async () => {
  const dependencies: ServerDependencies = {
    resolveAuthUser: async () => ({ id: 'admin-1', email: 'admin@example.com' }),
    query: async (sql, params) => {
      if (sql.includes('select 1 from public.admin_roles')) {
        assert.deepEqual(params, ['admin-1']);
        return { rows: [{ '?column?': 1 }], rowCount: 1 };
      }

      if (sql.includes('from auth.users') && sql.includes('where id = $1')) {
        assert.deepEqual(params, ['missing-user']);
        return { rows: [], rowCount: 0 };
      }

      throw new Error(`Unexpected query: ${sql}`);
    },
  };

  await withTestServer(dependencies, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/users/missing-user`, {
      method: 'DELETE',
      headers: {
        Authorization: 'Bearer admin-token',
      },
    });

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: 'User not found' });
  });
});

test('GET /api/users marks unconfirmed signups as pending instead of active', async () => {
  const dependencies: ServerDependencies = {
    resolveAuthUser: async () => ({ id: 'admin-1', email: 'admin@example.com' }),
    query: async (sql, params) => {
      if (sql.includes('select 1 from public.admin_roles')) {
        assert.deepEqual(params, ['admin-1']);
        return { rows: [{ '?column?': 1 }], rowCount: 1 };
      }

      if (sql.includes('from auth.users u') && sql.includes('left join public.profiles')) {
        assert.match(sql, /confirmed_at/i);
        return {
          rows: [
            {
              id: 'user-pending',
              username: 'pending-user',
              email: 'pending@example.com',
              status: 'pending',
            role: 'user',
            createdAt: '2026-04-23',
            generationCount: 0,
            inviteCount: 0,
            concurrencyLimit: 1,
          },
          {
            id: 'user-active',
              username: 'active-user',
              email: 'active@example.com',
              status: 'active',
            role: 'user',
            createdAt: '2026-04-22',
            generationCount: 2,
            inviteCount: 1,
            concurrencyLimit: 3,
          },
        ],
        rowCount: 2,
        };
      }

      throw new Error(`Unexpected query: ${sql}`);
    },
  };

  await withTestServer(dependencies, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/users`, {
      headers: {
        Authorization: 'Bearer admin-token',
      },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), [
      {
        id: 'user-pending',
        username: 'pending-user',
        email: 'pending@example.com',
        status: 'pending',
        role: 'user',
        createdAt: '2026-04-23',
        generationCount: 0,
        inviteCount: 0,
        concurrencyLimit: 1,
      },
      {
        id: 'user-active',
        username: 'active-user',
        email: 'active@example.com',
        status: 'active',
        role: 'user',
        createdAt: '2026-04-22',
        generationCount: 2,
        inviteCount: 1,
        concurrencyLimit: 3,
      },
    ]);
  });
});

test('PATCH /api/users/:id/settings updates the user concurrency limit', async () => {
  const dependencies: ServerDependencies = {
    resolveAuthUser: async () => ({ id: 'admin-1', email: 'admin@example.com' }),
    query: async (sql, params) => {
      if (sql.includes('select 1 from public.admin_roles')) {
        assert.deepEqual(params, ['admin-1']);
        return { rows: [{ '?column?': 1 }], rowCount: 1 };
      }

      if (sql.includes('update public.profiles') && sql.includes('concurrency_limit')) {
        assert.deepEqual(params, ['user-9', 5]);
        return {
          rows: [{ user_id: 'user-9', concurrency_limit: 5 }],
          rowCount: 1,
        };
      }

      throw new Error(`Unexpected query: ${sql}`);
    },
  };

  await withTestServer(dependencies, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/users/user-9/settings`, {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer admin-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        concurrencyLimit: 5,
      }),
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      id: 'user-9',
      concurrencyLimit: 5,
    });
  });
});

test('PATCH /api/users/:id/settings rejects invalid concurrency limit values', async () => {
  const dependencies: ServerDependencies = {
    resolveAuthUser: async () => ({ id: 'admin-1', email: 'admin@example.com' }),
    query: async (sql, params) => {
      if (sql.includes('select 1 from public.admin_roles')) {
        assert.deepEqual(params, ['admin-1']);
        return { rows: [{ '?column?': 1 }], rowCount: 1 };
      }

      throw new Error(`Unexpected query: ${sql}`);
    },
  };

  await withTestServer(dependencies, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/users/user-9/settings`, {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer admin-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        concurrencyLimit: 0,
      }),
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: 'concurrencyLimit must be an integer >= 1',
    });
  });
});
