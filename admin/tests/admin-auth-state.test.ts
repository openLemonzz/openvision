import assert from 'node:assert/strict';
import test from 'node:test';
import { handleAdminAuthStateChange } from '../src/hooks/admin-auth-state';

test('clears admin state immediately when auth session is missing', () => {
  const events: string[] = [];

  handleAdminAuthStateChange({
    session: null,
    clearAdminState: () => {
      events.push('clear');
    },
    setLoading: (loading) => {
      events.push(`loading:${loading}`);
    },
    syncAdminState: async () => {
      events.push('sync');
    },
  });

  assert.deepEqual(events, ['clear', 'loading:false']);
});

test('defers authenticated admin refresh and reuses the session access token', async () => {
  const events: string[] = [];
  let scheduledTask: (() => void) | null = null;

  handleAdminAuthStateChange({
    session: { access_token: 'session-token' },
    clearAdminState: () => {
      events.push('clear');
    },
    setLoading: (loading) => {
      events.push(`loading:${loading}`);
    },
    syncAdminState: async (accessToken) => {
      events.push(`sync:${accessToken}`);
    },
    schedule: (task) => {
      scheduledTask = task;
    },
  });

  assert.deepEqual(events, ['loading:true']);
  assert.ok(scheduledTask);

  scheduledTask?.();
  await Promise.resolve();
  await Promise.resolve();

  assert.deepEqual(events, [
    'loading:true',
    'sync:session-token',
    'loading:false',
  ]);
});
