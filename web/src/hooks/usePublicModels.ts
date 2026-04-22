import { useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin-api';
import type { ModelConfig } from '@/pages/admin/AdminModels';

interface PublicModelPayload {
  id: string;
  name: string;
  provider: string;
  enabled: boolean;
  maxTokens: number;
  temperature: number;
  defaultSize: string;
  protocol: ModelConfig['protocol'];
}

export function usePublicModels() {
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await adminFetch<PublicModelPayload[]>('/public/models');

        if (!alive) return;

        setModels(
          (data || []).map((row) => ({
            id: row.id,
            name: row.name,
            provider: row.provider,
            apiKey: '',
            apiEndpoint: '',
            enabled: row.enabled,
            maxTokens: row.maxTokens,
            temperature: row.temperature,
            defaultSize: row.defaultSize,
            protocol: row.protocol as ModelConfig['protocol'],
          }))
        );
      } catch (err) {
        if (!alive) return;
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setModels([]);
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      alive = false;
    };
  }, []);

  return { models, error, loading };
}
