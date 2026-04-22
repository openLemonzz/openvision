import type { ModelConfig } from '../../lib/types';

export interface EditableModelConfig extends ModelConfig {
  draftKey: string;
  isNew: boolean;
}

const DEFAULT_API_ENDPOINT = 'https://api.example.com/v1/images/generations';
const DEFAULT_PROVIDER = 'Custom API';

export function createEditableModels(models: ModelConfig[]): EditableModelConfig[] {
  return models.map((model) => ({
    ...model,
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

  let nextModelNumber = 1;
  const existingIds = new Set(models.map((model) => model.id.trim()));
  while (existingIds.has(`new-model-${nextModelNumber}`)) {
    nextModelNumber += 1;
  }

  return {
    draftKey: `draft:${nextDraftNumber}`,
    isNew: true,
    id: `new-model-${nextModelNumber}`,
    name: `新模型 ${nextModelNumber}`,
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
  const idCounts = new Map<string, number>();

  for (const model of models) {
    const id = model.id.trim();
    if (id) {
      idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
    }
  }

  for (const [id, count] of idCounts.entries()) {
    if (count > 1) {
      errors.push(`模型“${id}”重复，请使用唯一的请求模型 ID。`);
    }
  }

  models.forEach((model, index) => {
    const row = index + 1;
    if (!model.id.trim()) {
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
  return models.map(({ draftKey: _draftKey, isNew: _isNew, ...model }) => ({
    ...model,
    id: model.id.trim(),
    name: model.name.trim(),
    provider: model.provider.trim(),
    apiKey: model.apiKey.trim(),
    apiEndpoint: model.apiEndpoint.trim(),
  }));
}
