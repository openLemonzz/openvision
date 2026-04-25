import test from 'node:test';
import assert from 'node:assert/strict';

import * as utils from './utils.ts';

type TestRecord = {
  id: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  imageUrl?: string;
};

function record(
  id: string,
  status: TestRecord['status'],
  imageUrl = status === 'completed' ? `https://cdn.example.com/${id}.png` : ''
): TestRecord {
  return { id, status, imageUrl };
}

test('countActiveGenerations counts only pending and generating records', () => {
  const { countActiveGenerations } = utils as {
    countActiveGenerations?: (records: TestRecord[]) => number;
  };

  assert.equal(typeof countActiveGenerations, 'function');
  assert.equal(
    countActiveGenerations?.([
      record('a', 'pending'),
      record('b', 'generating'),
      record('c', 'completed'),
      record('d', 'failed'),
    ]),
    2
  );
});

test('findLatestCompletionRevealId returns the newest record that just completed', () => {
  const { findLatestCompletionRevealId } = utils as {
    findLatestCompletionRevealId?: (
      previousRecords: TestRecord[],
      nextRecords: TestRecord[]
    ) => string | null;
  };

  assert.equal(typeof findLatestCompletionRevealId, 'function');
  assert.equal(
    findLatestCompletionRevealId?.(
      [record('gen-2', 'completed'), record('gen-1', 'generating')],
      [record('gen-2', 'completed'), record('gen-1', 'completed')]
    ),
    null
  );
  assert.equal(
    findLatestCompletionRevealId?.(
      [record('gen-9', 'generating'), record('gen-8', 'completed')],
      [record('gen-9', 'completed'), record('gen-8', 'completed')]
    ),
    'gen-9'
  );
});

test('findLatestCompletionRevealId ignores initial loads and non-latest completions', () => {
  const { findLatestCompletionRevealId } = utils as {
    findLatestCompletionRevealId?: (
      previousRecords: TestRecord[],
      nextRecords: TestRecord[]
    ) => string | null;
  };

  assert.equal(typeof findLatestCompletionRevealId, 'function');
  assert.equal(
    findLatestCompletionRevealId?.([], [record('gen-1', 'completed')]),
    null
  );
  assert.equal(
    findLatestCompletionRevealId?.(
      [record('gen-2', 'completed'), record('gen-1', 'generating')],
      [record('gen-2', 'completed'), record('gen-1', 'failed')]
    ),
    null
  );
});

test('resolveGenerateAvailability locks the button before capacity is known', () => {
  const { resolveGenerateAvailability } = utils as {
    resolveGenerateAvailability?: (args: {
      capacity: {
        concurrencyLimit: number;
        activeGenerationCount: number;
        canGenerate: boolean;
        reason: string | null;
      } | null;
      isCheckingCapacity: boolean;
      isWaitingForCapacityConfirmation: boolean;
    }) => { canGenerate: boolean; state: string; reason: string | null };
  };

  assert.equal(typeof resolveGenerateAvailability, 'function');
  assert.deepEqual(
    resolveGenerateAvailability?.({
      capacity: null,
      isCheckingCapacity: true,
      isWaitingForCapacityConfirmation: false,
    }),
    {
      canGenerate: false,
      state: 'syncing',
      reason: null,
    }
  );
});

test('resolveGenerateAvailability unlocks only when backend capacity allows generation', () => {
  const { resolveGenerateAvailability } = utils as {
    resolveGenerateAvailability?: (args: {
      capacity: {
        concurrencyLimit: number;
        activeGenerationCount: number;
        canGenerate: boolean;
        reason: string | null;
      } | null;
      isCheckingCapacity: boolean;
      isWaitingForCapacityConfirmation: boolean;
    }) => { canGenerate: boolean; state: string; reason: string | null };
  };

  assert.equal(typeof resolveGenerateAvailability, 'function');
  assert.deepEqual(
    resolveGenerateAvailability?.({
      capacity: {
        concurrencyLimit: 2,
        activeGenerationCount: 1,
        canGenerate: true,
        reason: null,
      },
      isCheckingCapacity: false,
      isWaitingForCapacityConfirmation: false,
    }),
    {
      canGenerate: true,
      state: 'ready',
      reason: null,
    }
  );
  assert.deepEqual(
    resolveGenerateAvailability?.({
      capacity: {
        concurrencyLimit: 2,
        activeGenerationCount: 2,
        canGenerate: false,
        reason: 'concurrency_limit_reached',
      },
      isCheckingCapacity: false,
      isWaitingForCapacityConfirmation: false,
    }),
    {
      canGenerate: false,
      state: 'blocked',
      reason: 'concurrency_limit_reached',
    }
  );
});

test('resolveGenerateAvailability relocks the button after submit until backend confirms again', () => {
  const { resolveGenerateAvailability } = utils as {
    resolveGenerateAvailability?: (args: {
      capacity: {
        concurrencyLimit: number;
        activeGenerationCount: number;
        canGenerate: boolean;
        reason: string | null;
      } | null;
      isCheckingCapacity: boolean;
      isWaitingForCapacityConfirmation: boolean;
    }) => { canGenerate: boolean; state: string; reason: string | null };
  };

  assert.equal(typeof resolveGenerateAvailability, 'function');
  assert.deepEqual(
    resolveGenerateAvailability?.({
      capacity: {
        concurrencyLimit: 3,
        activeGenerationCount: 1,
        canGenerate: true,
        reason: null,
      },
      isCheckingCapacity: false,
      isWaitingForCapacityConfirmation: true,
    }),
    {
      canGenerate: false,
      state: 'syncing',
      reason: null,
    }
  );
});

test('resolveGenerateAvailability keeps a confirmed ready state during silent background polling', () => {
  const { resolveGenerateAvailability } = utils as {
    resolveGenerateAvailability?: (args: {
      capacity: {
        concurrencyLimit: number;
        activeGenerationCount: number;
        canGenerate: boolean;
        reason: string | null;
      } | null;
      isCheckingCapacity: boolean;
      isWaitingForCapacityConfirmation: boolean;
    }) => { canGenerate: boolean; state: string; reason: string | null };
  };

  assert.equal(typeof resolveGenerateAvailability, 'function');
  assert.deepEqual(
    resolveGenerateAvailability?.({
      capacity: {
        concurrencyLimit: 1,
        activeGenerationCount: 0,
        canGenerate: true,
        reason: null,
      },
      isCheckingCapacity: true,
      isWaitingForCapacityConfirmation: false,
    }),
    {
      canGenerate: true,
      state: 'ready',
      reason: null,
    }
  );
});

test('buildGenerationProgressTrack keeps stage 1 unresolved before first capacity confirmation', () => {
  const { buildGenerationProgressTrack } = utils as {
    buildGenerationProgressTrack?: (phase: string) => Array<{ label: string; state: string }>;
  };

  assert.equal(typeof buildGenerationProgressTrack, 'function');
  assert.deepEqual(
    buildGenerationProgressTrack?.('unconfirmed')?.map((stage) => ({
      label: stage.label,
      state: stage.state,
    })),
    [
      { label: '资格通过', state: 'pending' },
      { label: '任务创建', state: 'pending' },
      { label: '进入队列', state: 'pending' },
      { label: '模型生成', state: 'pending' },
      { label: '结果返回', state: 'pending' },
    ]
  );
});

test('buildGenerationProgressTrack fills one stage at a time across the generation lifecycle', () => {
  const { buildGenerationProgressTrack } = utils as {
    buildGenerationProgressTrack?: (phase: string) => Array<{ label: string; state: string }>;
  };

  assert.equal(typeof buildGenerationProgressTrack, 'function');
  assert.deepEqual(
    buildGenerationProgressTrack?.('ready')?.map((stage) => stage.state),
    ['complete', 'pending', 'pending', 'pending', 'pending']
  );
  assert.deepEqual(
    buildGenerationProgressTrack?.('requesting')?.map((stage) => stage.state),
    ['complete', 'complete', 'pending', 'pending', 'pending']
  );
  assert.deepEqual(
    buildGenerationProgressTrack?.('pending')?.map((stage) => stage.state),
    ['complete', 'complete', 'complete', 'pending', 'pending']
  );
  assert.deepEqual(
    buildGenerationProgressTrack?.('generating')?.map((stage) => stage.state),
    ['complete', 'complete', 'complete', 'complete', 'pending']
  );
  assert.deepEqual(
    buildGenerationProgressTrack?.('completed')?.map((stage) => stage.state),
    ['complete', 'complete', 'complete', 'complete', 'complete']
  );
  assert.deepEqual(
    buildGenerationProgressTrack?.('failed')?.map((stage) => stage.state),
    ['complete', 'complete', 'complete', 'complete', 'failed']
  );
});

test('resolveGenerationRecordProgressPhase maps record status into the five-stage lifecycle', () => {
  const { resolveGenerationRecordProgressPhase } = utils as {
    resolveGenerationRecordProgressPhase?: (record: TestRecord) => string;
  };

  assert.equal(typeof resolveGenerationRecordProgressPhase, 'function');
  assert.equal(resolveGenerationRecordProgressPhase?.(record('temp-1', 'pending')), 'requesting');
  assert.equal(resolveGenerationRecordProgressPhase?.(record('gen-1', 'pending')), 'pending');
  assert.equal(resolveGenerationRecordProgressPhase?.(record('gen-2', 'generating')), 'generating');
  assert.equal(resolveGenerationRecordProgressPhase?.(record('gen-3', 'completed')), 'completed');
  assert.equal(resolveGenerationRecordProgressPhase?.(record('gen-4', 'failed')), 'failed');
});

test('buildGenerateRequestPayload includes the reference image only when edit mode is active', () => {
  const { buildGenerateRequestPayload } = utils as {
    buildGenerateRequestPayload?: (args: {
      prompt: string;
      modelId: string;
      aspectRatio: string;
      styleStrength: number;
      referenceImageUrl?: string | null;
    }) => Record<string, unknown>;
  };

  assert.equal(typeof buildGenerateRequestPayload, 'function');
  assert.deepEqual(
    buildGenerateRequestPayload?.({
      prompt: 'edit this',
      modelId: 'gpt-image-2',
      aspectRatio: '1:1',
      styleStrength: 60,
      referenceImageUrl: 'https://cdn.example.com/reference.png',
    }),
    {
      prompt: 'edit this',
      modelId: 'gpt-image-2',
      aspectRatio: '1:1',
      styleStrength: 60,
      referenceImageUrl: 'https://cdn.example.com/reference.png',
    }
  );
  assert.deepEqual(
    buildGenerateRequestPayload?.({
      prompt: 'normal generate',
      modelId: 'gpt-image-2',
      aspectRatio: '16:9',
      styleStrength: 75,
      referenceImageUrl: '   ',
    }),
    {
      prompt: 'normal generate',
      modelId: 'gpt-image-2',
      aspectRatio: '16:9',
      styleStrength: 75,
    }
  );
});
