import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createModelDraft,
  toPersistedModels,
  validateEditableModels,
  type EditableModelConfig,
} from '../src/pages/admin/model-drafts';

test('createModelDraft creates a new editable model with a generated mod id and sensible defaults', () => {
  const existing: EditableModelConfig[] = [
    {
      draftKey: 'existing:gpt-image-2',
      isNew: false,
      id: 'gpt-image-2',
      requestModelId: 'gpt-image-2',
      name: 'GPT-Image-2',
      provider: 'OpenAI Compatible',
      apiKey: '',
      apiEndpoint: 'https://api.example.com/v1/images/generations',
      enabled: true,
      maxTokens: 1000,
      temperature: 0.7,
      defaultSize: '1024x1024',
      protocol: 'openai',
      hasApiKey: true,
    },
    {
      draftKey: 'draft:1',
      isNew: true,
      id: 'mod_1713873600000_3lllll',
      requestModelId: 'mod_1713873600000_3lllll',
      name: '新模型 1',
      provider: 'Custom API',
      apiKey: '',
      apiEndpoint: 'https://api.example.com/v1/images/generations',
      enabled: false,
      maxTokens: 1000,
      temperature: 0.7,
      defaultSize: '1024x1024',
      protocol: 'openai',
    },
  ];

  const originalDateNow = Date.now;
  const originalRandom = Math.random;
  const randomValues = [0.1, 0.2];
  let randomCallCount = 0;

  Date.now = () => 1713873600000;
  Math.random = () => randomValues[randomCallCount++] ?? 0.3;

  let draft: EditableModelConfig;
  try {
    draft = createModelDraft(existing);
  } finally {
    Date.now = originalDateNow;
    Math.random = originalRandom;
  }

  assert.equal(draft.draftKey, 'draft:2');
  assert.equal(draft.id, 'mod_1713873600000_777777');
  assert.equal(draft.requestModelId, draft.id);
  assert.equal(draft.name, '新模型 2');
  assert.equal(draft.provider, 'Custom API');
  assert.equal(draft.apiEndpoint, 'https://api.example.com/v1/images/generations');
  assert.equal(draft.enabled, false);
});

test('toPersistedModels trims fields and validation blocks duplicate or missing model identifiers', () => {
  const editableModels: EditableModelConfig[] = [
    {
      draftKey: 'draft:1',
      isNew: true,
      id: '  custom-config  ',
      requestModelId: '  custom-image  ',
      name: '  Custom Image  ',
      provider: '  Custom API  ',
      apiKey: ' sk-test ',
      apiEndpoint: ' https://example.com/v1/images ',
      enabled: true,
      maxTokens: 2048,
      temperature: 1,
      defaultSize: '1024x1024',
      protocol: 'custom',
    },
    {
      draftKey: 'draft:2',
      isNew: true,
      id: 'custom-config',
      requestModelId: 'custom-image',
      name: '',
      provider: '',
      apiKey: '',
      apiEndpoint: '',
      enabled: false,
      maxTokens: 1000,
      temperature: 0.7,
      defaultSize: '1024x1024',
      protocol: 'openai',
    },
  ];

  assert.deepEqual(validateEditableModels(editableModels), [
    '配置 ID“custom-config”重复，请使用唯一的配置 ID。',
    '模型 #2 缺少显示名称。',
    '模型 #2 缺少 Provider。',
    '模型 #2 缺少 API Endpoint。',
  ]);

  assert.deepEqual(toPersistedModels([editableModels[0]]), [
    {
      id: 'custom-config',
      requestModelId: 'custom-image',
      name: 'Custom Image',
      provider: 'Custom API',
      apiKey: 'sk-test',
      apiEndpoint: 'https://example.com/v1/images',
      enabled: true,
      maxTokens: 2048,
      temperature: 1,
      defaultSize: '1024x1024',
      protocol: 'custom',
    },
  ]);
});

test('validation allows multiple configs to share one upstream request model id', () => {
  const editableModels: EditableModelConfig[] = [
    {
      draftKey: 'draft:1',
      isNew: true,
      id: 'openai-fast',
      requestModelId: 'gpt-image-2',
      name: 'OpenAI Fast',
      provider: 'OpenAI Compatible',
      apiKey: '',
      apiEndpoint: 'https://example.com/v1/images',
      enabled: true,
      maxTokens: 1000,
      temperature: 0.7,
      defaultSize: '1024x1024',
      protocol: 'openai',
    },
    {
      draftKey: 'draft:2',
      isNew: true,
      id: 'openai-cheap',
      requestModelId: 'gpt-image-2',
      name: 'OpenAI Cheap',
      provider: 'OpenAI Compatible',
      apiKey: '',
      apiEndpoint: 'https://example.com/v1/images',
      enabled: true,
      maxTokens: 1000,
      temperature: 0.7,
      defaultSize: '1024x1024',
      protocol: 'openai',
    },
  ];

  assert.deepEqual(validateEditableModels(editableModels), []);
});
