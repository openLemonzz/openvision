export type AppInitializationKind =
  | 'checking'
  | 'ready'
  | 'config-missing'
  | 'network-error'
  | 'backend-uninitialized';

export function resolveAppShellState(initializationKind: AppInitializationKind) {
  const hasBlockingConfigurationError = initializationKind === 'config-missing';
  const hasActionableInitializationProblem =
    initializationKind === 'config-missing' ||
    initializationKind === 'network-error' ||
    initializationKind === 'backend-uninitialized';

  return {
    shouldMountRoutes: !hasBlockingConfigurationError,
    shouldShowInitializationScreen: hasActionableInitializationProblem,
  };
}
