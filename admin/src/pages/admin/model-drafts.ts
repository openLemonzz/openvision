import type { ModelConfig } from '../../lib/types';

export interface EditableModelConfig extends ModelConfig {
  draftKey: string;
  isNew: boolean;
}

const DEFAULT_API_ENDPOINT = 'https://api.example.com/v1/images/generations';
const DEFAULT_PROVIDER = 'Custom API';

function generateModelConfigId(existingIds: Set<string>) {
  let candidate = '';

  do {
    candidate = `mod_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  } while (existingIds.has(candidate));

  return candidate;
}

export function createEditableModels(models: ModelConfig[]): EditableModelConfig[] {
  return models.map((model) => ({
    ...model,
    requestModelId: model.requestModelId || model.id,
    draftKey: `existing:${model.id}`,
    isNew: false,
  }));
}

export function createModelDraft(models: EditableModelConfig[]): EditableModelConfig {
  let nextDraftNumber = 1;
  const existingDraftKeys = new Set(models.map((model) => model.draftKey));
  while (existingDraftKeys.has(`draft:${nextDraftNumber}`)) {
    nextDraftNumber += 1;
  }

  const existingIds = new Set(models.map((model) => model.id.trim()));
  const nextModelId = generateModelConfigId(existingIds);

  return {
    draftKey: `draft:${nextDraftNumber}`,
    isNew: true,
    id: nextModelId,
    requestModelId: nextModelId,
    name: `新模型 ${nextDraftNumber}`,
    provider: DEFAULT_PROVIDER,
    apiKey: '',
    apiEndpoint: DEFAULT_API_ENDPOINT,
    enabled: false,
    maxTokens: 1000,
    temperature: 0.7,
    defaultSize: '1024x1024',
    protocol: 'openai',
    hasApiKey: false,
  };
}

export function validateEditableModels(models: EditableModelConfig[]) {
  const errors: string[] = [];
  const configIdCounts = new Map<string, number>();

  for (const model of models) {
    const id = model.id.trim();
    if (id) {
      configIdCounts.set(id, (configIdCounts.get(id) ?? 0) + 1);
    }
  }

  for (const [id, count] of configIdCounts.entries()) {
    if (count > 1) {
      errors.push(`配置 ID“${id}”重复，请使用唯一的配置 ID。`);
    }
  }

  models.forEach((model, index) => {
    const row = index + 1;
    if (!model.id.trim()) {
      errors.push(`模型 #${row} 缺少配置 ID。`);
    }
    if (!model.requestModelId.trim()) {
      errors.push(`模型 #${row} 缺少请求模型 ID。`);
    }
    if (!model.name.trim()) {
      errors.push(`模型 #${row} 缺少显示名称。`);
    }
    if (!model.provider.trim()) {
      errors.push(`模型 #${row} 缺少 Provider。`);
    }
    if (!model.apiEndpoint.trim()) {
      errors.push(`模型 #${row} 缺少 API Endpoint。`);
    }
  });

  return errors;
}

export function toPersistedModels(models: EditableModelConfig[]): ModelConfig[] {
  return models.map((model) => {
    const persisted: ModelConfig = {
      id: model.id.trim(),
      requestModelId: model.requestModelId.trim(),
      name: model.name.trim(),
      provider: model.provider.trim(),
      apiKey: model.apiKey.trim(),
      apiEndpoint: model.apiEndpoint.trim(),
      enabled: model.enabled,
      maxTokens: model.maxTokens,
      temperature: model.temperature,
      defaultSize: model.defaultSize,
      protocol: model.protocol,
    };

    if (typeof model.hasApiKey !== 'undefined') {
      persisted.hasApiKey = model.hasApiKey;
    }

    return persisted;
  });
}
