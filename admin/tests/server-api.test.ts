import assert from 'node:assert/strict';
import test from 'node:test';
import type { AddressInfo } from 'node:net';

import { createApp, type ServerDependencies } from '../server/app.js';

async function withTestServer(
  dependencies: ServerDependencies,
  run: (baseUrl: string) => Promise<void>
) {
  const app = createApp(dependencies);
  const server = app.listen(0);

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

test('POST /api/generate rejects disabled users before any upstream model call', async () => {
  let fetchCalled = false;

  const dependencies: ServerDependencies = {
    resolveAuthUser: async () => ({ id: 'disabled-user', email: 'disabled@example.com' }),
    query: async (sql, params) => {
      if (sql.includes('select is_disabled from public.profiles')) {
        assert.deepEqual(params, ['disabled-user']);
        return {
          rows: [{ is_disabled: true }],
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
      },
    ]);
  });
});
