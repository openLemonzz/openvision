export interface AdminAuthStateSession {
  access_token: string;
}

interface HandleAdminAuthStateChangeOptions {
  session: AdminAuthStateSession | null;
  clearAdminState: () => void;
  setLoading: (loading: boolean) => void;
  syncAdminState: (accessToken: string) => Promise<void>;
  onSyncError?: () => void;
  schedule?: (task: () => void) => void;
}

export function handleAdminAuthStateChange({
  session,
  clearAdminState,
  setLoading,
  syncAdminState,
  onSyncError,
  schedule = (task) => {
    setTimeout(task, 0);
  },
}: HandleAdminAuthStateChangeOptions) {
  if (!session) {
    clearAdminState();
    setLoading(false);
    return;
  }

  setLoading(true);

  schedule(() => {
    void (async () => {
      try {
        await syncAdminState(session.access_token);
      } catch {
        onSyncError?.();
      } finally {
        setLoading(false);
      }
    })();
  });
}
