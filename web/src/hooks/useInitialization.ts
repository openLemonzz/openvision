import { useCallback, useEffect, useState } from 'react';
import {
  type InitializationReadiness,
  evaluateInitializationReadiness,
} from '@/lib/runtime-config';
import { appRuntimeConfig, getFunctionUrl, isDockerRuntime } from '@/lib/supabase';

const PROBED_FUNCTIONS = ['check-email', 'admin-users', 'generate-image'] as const;
const RETRY_INTERVAL_MS = 5000;

type ConfigMissingState = {
  kind: 'config-missing';
  message: string;
  missingKeys: string[];
};

type CheckingState = {
  kind: 'checking';
  message: string;
  missingKeys: [];
  missingResources: [];
  missingFunctions: [];
};

type ReadyState = {
  kind: 'ready';
  message: string;
  missingKeys: [];
  missingResources: [];
  missingFunctions: [];
};

export type InitializationStatus =
  | ConfigMissingState
  | CheckingState
  | ReadyState
  | InitializationReadiness;

function getInitialStatus(): InitializationStatus {
  if (!isDockerRuntime) {
    return {
      kind: 'ready',
      message: 'Local runtime does not require Docker initialization.',
      missingKeys: [],
      missingResources: [],
      missingFunctions: [],
    };
  }

  if (appRuntimeConfig.gate.kind === 'config-missing') {
    return {
      kind: 'config-missing',
      message: 'Missing required Docker runtime variables.',
      missingKeys: appRuntimeConfig.gate.missingKeys,
    };
  }

  return {
    kind: 'checking',
    message: 'Checking Supabase readiness...',
    missingKeys: [],
    missingResources: [],
    missingFunctions: [],
  };
}

async function probeFunction(name: string) {
  try {
    const response = await fetch(getFunctionUrl(name), {
      method: 'OPTIONS',
      cache: 'no-store',
    });

    return {
      name,
      status: response.status,
    };
  } catch {
    return {
      name,
      status: 0,
    };
  }
}

export function useInitialization() {
  const [status, setStatus] = useState<InitializationStatus>(getInitialStatus);

  const refresh = useCallback(async () => {
    if (!isDockerRuntime) {
      setStatus(getInitialStatus());
      return {
        kind: 'ready',
        message: 'Local runtime does not require Docker initialization.',
        missingKeys: [],
        missingResources: [],
        missingFunctions: [],
      } satisfies InitializationStatus;
    }

    if (appRuntimeConfig.gate.kind === 'config-missing') {
      const next = getInitialStatus();
      setStatus(next);
      return next;
    }

    setStatus({
      kind: 'checking',
      message: 'Checking Supabase readiness...',
      missingKeys: [],
      missingResources: [],
      missingFunctions: [],
    });

    try {
      const healthResponse = await fetch(getFunctionUrl('health'), {
        method: 'GET',
        cache: 'no-store',
      });
      const healthPayload = healthResponse.ok
        ? ((await healthResponse.json()) as {
            ready: boolean;
            missingResources: string[];
            message: string;
          })
        : null;
      const functionProbes = await Promise.all(
        PROBED_FUNCTIONS.map((name) => probeFunction(name))
      );

      const next = evaluateInitializationReadiness({
        health: {
          reachable: true,
          status: healthResponse.status,
          payload: healthPayload,
        },
        functionProbes,
      });

      setStatus(next);
      return next;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const next: InitializationStatus = {
        kind: 'network-error',
        message,
        missingResources: [],
        missingFunctions: [],
      };
      setStatus(next);
      return next;
    }
  }, []);

  useEffect(() => {
    if (!isDockerRuntime || appRuntimeConfig.gate.kind === 'config-missing') {
      return;
    }

    let cancelled = false;
    let retryTimer: number | undefined;

    const run = async () => {
      const next = await refresh();
      if (!cancelled && next.kind !== 'ready') {
        retryTimer = window.setTimeout(run, RETRY_INTERVAL_MS);
      }
    };

    void run();

    return () => {
      cancelled = true;
      if (retryTimer) {
        window.clearTimeout(retryTimer);
      }
    };
  }, [refresh]);

  return {
    status,
    refresh,
    runtimeConfig: appRuntimeConfig,
  };
}
