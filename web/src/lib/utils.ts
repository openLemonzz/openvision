import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type ActiveGenerationRecord = {
  status: string;
};

type RevealGenerationRecord = {
  id: string;
  status: string;
  imageUrl?: string | null;
};

type ProgressGenerationRecord = {
  id: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
};

export type GenerationCapacitySnapshot = {
  concurrencyLimit: number;
  activeGenerationCount: number;
  canGenerate: boolean;
  reason: string | null;
};

export type GenerationProgressPhase =
  | 'unconfirmed'
  | 'ready'
  | 'requesting'
  | 'pending'
  | 'generating'
  | 'completed'
  | 'failed';

export type GenerationProgressStage = {
  key: 'capacity_confirmed' | 'task_created' | 'queued' | 'generating' | 'settled';
  label: '资格通过' | '任务创建' | '进入队列' | '模型生成' | '结果返回';
  state: 'pending' | 'complete' | 'failed';
};

export function countActiveGenerations(records: ActiveGenerationRecord[]) {
  return records.filter((record) => record.status === 'pending' || record.status === 'generating').length;
}

export function findLatestCompletionRevealId(
  previousRecords: RevealGenerationRecord[],
  nextRecords: RevealGenerationRecord[],
) {
  if (previousRecords.length === 0 || nextRecords.length === 0) {
    return null;
  }

  const latestRecord = nextRecords[0];
  if (latestRecord.status !== 'completed' || !latestRecord.imageUrl) {
    return null;
  }

  const previousVersion = previousRecords.find((record) => record.id === latestRecord.id);
  if (!previousVersion) {
    return null;
  }

  if (previousVersion.status === 'pending' || previousVersion.status === 'generating') {
    return latestRecord.id;
  }

  return null;
}

export function resolveGenerateAvailability(args: {
  capacity: GenerationCapacitySnapshot | null;
  isCheckingCapacity: boolean;
  isWaitingForCapacityConfirmation: boolean;
}) {
  if (!args.capacity) {
    return {
      canGenerate: false,
      state: 'syncing' as const,
      reason: null,
    };
  }

  if (args.isWaitingForCapacityConfirmation) {
    return {
      canGenerate: false,
      state: 'syncing' as const,
      reason: null,
    };
  }

  if (!args.capacity.canGenerate) {
    return {
      canGenerate: false,
      state: 'blocked' as const,
      reason: args.capacity.reason,
    };
  }

  if (args.isCheckingCapacity) {
    return {
      canGenerate: true,
      state: 'ready' as const,
      reason: null,
    };
  }

  return {
    canGenerate: true,
    state: 'ready' as const,
    reason: null,
  };
}

const PROGRESS_TRACK: Array<Pick<GenerationProgressStage, 'key' | 'label'>> = [
  { key: 'capacity_confirmed', label: '资格通过' },
  { key: 'task_created', label: '任务创建' },
  { key: 'queued', label: '进入队列' },
  { key: 'generating', label: '模型生成' },
  { key: 'settled', label: '结果返回' },
];

const PROGRESS_PHASE_INDEX: Record<GenerationProgressPhase, number> = {
  unconfirmed: -1,
  ready: 0,
  requesting: 1,
  pending: 2,
  generating: 3,
  completed: 4,
  failed: 4,
};

export function buildGenerationProgressTrack(phase: GenerationProgressPhase): GenerationProgressStage[] {
  return PROGRESS_TRACK.map((stage, index) => {
    if (phase === 'failed' && index === PROGRESS_TRACK.length - 1) {
      return { ...stage, state: 'failed' as const };
    }

    return {
      ...stage,
      state: index <= PROGRESS_PHASE_INDEX[phase] ? 'complete' as const : 'pending' as const,
    };
  });
}

export function resolveGenerationRecordProgressPhase(record: ProgressGenerationRecord): GenerationProgressPhase {
  if (record.id.startsWith('temp-')) {
    return 'requesting';
  }

  if (record.status === 'pending') {
    return 'pending';
  }

  if (record.status === 'generating') {
    return 'generating';
  }

  if (record.status === 'completed') {
    return 'completed';
  }

  return 'failed';
}
