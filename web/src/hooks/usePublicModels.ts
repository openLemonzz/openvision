import { useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin-api';
import type { ModelConfig } from '@/pages/admin/AdminModels';

interface PublicModelPayload {
  id: string;
  name: string;
  provider: string;
  default_size: string;
  protocol: ModelConfig['protocol'];
}

export function usePublicModels() {
  const [models, setModels] = useState<ModelConfig[]>([]);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const payload = await adminFetch<PublicModelPayload[]>('/public/models');
        if (!alive) return;

        setModels(
          payload.map((model) => ({
            id: model.id,
            name: model.name,
            provider: model.provider,
            apiKey: '',
            apiEndpoint: '',
            enabled: true,
            maxTokens: 1000,
            temperature: 0.7,
            defaultSize: model.default_size,
            protocol: model.protocol,
          }))
        );
      } catch {
        if (!alive) return;
        setModels([]);
      }
    };

    void load();

    return () => {
      alive = false;
    };
  }, []);

  return models;
}
