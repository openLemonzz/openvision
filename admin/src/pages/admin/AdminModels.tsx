import { useEffect, useState } from 'react';
import { Save, Key, Globe, Sliders, ToggleLeft, ToggleRight, AlertTriangle, Check, Plus, Trash2, Activity } from 'lucide-react';
import type { ApiProtocol, ModelConfig, ModelTestResult } from '@/lib/types';
import {
  createEditableModels,
  createModelDraft,
  toPersistedModels,
  validateEditableModels,
  type EditableModelConfig,
} from './model-drafts';

interface AdminModelsProps {
  models: ModelConfig[];
  onUpdateModels: (models: ModelConfig[]) => Promise<void>;
  onDeleteModel: (id: string) => Promise<void>;
  onTestModel: (model: ModelConfig) => Promise<ModelTestResult>;
}

const SIZE_OPTIONS = ['1024x1024', '1024x576', '768x1024', '576x1024', '1792x1024', '1024x1792'];

const PROTOCOL_OPTIONS: { value: ApiProtocol; label: string }[] = [
  { value: 'openai', label: 'OpenAI 兼容' },
  { value: 'midjourney', label: 'Midjourney' },
  { value: 'stability', label: 'Stability AI' },
  { value: 'custom', label: '自定义 / 其他' },
];

function readErrorMessage(error: unknown) {
  const rawMessage = error instanceof Error ? error.message : String(error);

  try {
    const parsed = JSON.parse(rawMessage) as { error?: unknown };
    if (typeof parsed.error === 'string' && parsed.error.trim()) {
      return parsed.error.trim();
    }
  } catch {
    // Fall through to the raw message.
  }

  return rawMessage;
}

export default function AdminModels({ models, onUpdateModels, onDeleteModel, onTestModel }: AdminModelsProps) {
  const [localModels, setLocalModels] = useState<EditableModelConfig[]>(() => createEditableModels(models));
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [deletingKeys, setDeletingKeys] = useState<Record<string, boolean>>({});
  const [testingKeys, setTestingKeys] = useState<Record<string, boolean>>({});
  const [testResults, setTestResults] = useState<Record<string, ModelTestResult>>({});

  useEffect(() => {
    setLocalModels(createEditableModels(models));
  }, [models]);

  const updateModel = (draftKey: string, updates: Partial<ModelConfig>) => {
    setLocalModels(prev => prev.map(model => model.draftKey === draftKey ? { ...model, ...updates } : model));
    setSaved(false);
    setErrors([]);
  };

  const addModel = () => {
    setLocalModels(prev => [...prev, createModelDraft(prev)]);
    setSaved(false);
    setErrors([]);
  };

  const removeModel = async (model: EditableModelConfig) => {
    if (!model.isNew && !window.confirm(`删除模型配置 ${model.id}？`)) {
      return;
    }

    if (model.isNew) {
      setLocalModels(prev => prev.filter((item) => item.draftKey !== model.draftKey));
      setSaved(false);
      setErrors([]);
      setTestResults((prev) => {
        const next = { ...prev };
        delete next[model.draftKey];
        return next;
      });
      return;
    }

    setDeletingKeys((prev) => ({ ...prev, [model.draftKey]: true }));
    setErrors([]);

    try {
      await onDeleteModel(model.id);
      setLocalModels(prev => prev.filter((item) => item.draftKey !== model.draftKey));
      setTestResults((prev) => {
        const next = { ...prev };
        delete next[model.draftKey];
        return next;
      });
    } catch (error) {
      setErrors([readErrorMessage(error)]);
    } finally {
      setDeletingKeys((prev) => {
        const next = { ...prev };
        delete next[model.draftKey];
        return next;
      });
    }
  };

  const testModel = async (model: EditableModelConfig) => {
    const validationErrors = validateEditableModels([model]);
    if (validationErrors.length > 0) {
      setTestResults((prev) => ({
        ...prev,
        [model.draftKey]: {
          ok: false,
          message: validationErrors[0],
        },
      }));
      return;
    }

    setTestingKeys((prev) => ({ ...prev, [model.draftKey]: true }));
    setErrors([]);

    try {
      const [persistedModel] = toPersistedModels([model]);
      const result = await onTestModel(persistedModel);
      setTestResults((prev) => ({ ...prev, [model.draftKey]: result }));
    } catch (error) {
      setTestResults((prev) => ({
        ...prev,
        [model.draftKey]: {
          ok: false,
          message: readErrorMessage(error),
        },
      }));
    } finally {
      setTestingKeys((prev) => {
        const next = { ...prev };
        delete next[model.draftKey];
        return next;
      });
    }
  };

  const handleSave = async () => {
    const validationErrors = validateEditableModels(localModels);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      setSaved(false);
      return;
    }

    setSaving(true);
    setErrors([]);

    try {
      const nextModels = toPersistedModels(localModels);
      await onUpdateModels(nextModels);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      setErrors([
        readErrorMessage(error),
      ]);
      setSaved(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1200px]">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h2 className="text-[14px] font-normal text-white tracking-[0.08em]">模型配置</h2>
          <p className="text-[10px] text-[#666] font-mono-data mt-1">
            管理 AI 图片生成模型的 API 接入参数
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={addModel}
            className="flex items-center gap-2 px-5 py-2.5 text-[11px] uppercase tracking-[0.12em] font-mono-data border border-[#333] text-white hover:border-white transition-colors"
          >
            <Plus size={13} />
            新增模型
          </button>
          <button
            onClick={() => {
              void handleSave();
            }}
            disabled={saving}
            className={`flex items-center gap-2 px-5 py-2.5 text-[11px] uppercase tracking-[0.12em] font-mono-data transition-all disabled:opacity-60 ${
              saved
                ? 'bg-emerald-500 text-white'
                : 'bg-white text-black hover:bg-[#e0e0e0]'
            }`}
          >
            {saved ? <Check size={13} /> : <Save size={13} />}
            {saving ? '保存中...' : saved ? '已保存' : '保存配置'}
          </button>
        </div>
      </div>

      {/* Warning banner */}
      <div className="flex items-start gap-3 border border-amber-400/20 bg-amber-400/5 p-4 mb-6">
        <AlertTriangle size={14} className="text-amber-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-[11px] text-amber-400/80 leading-relaxed">
            API Key 只会发送到 admin 服务并以密文存入数据库，不会作为明文保存在浏览器。
          </p>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="border border-red-400/30 bg-red-400/5 p-4 mb-6">
          <p className="text-[11px] text-red-300 font-mono-data mb-2">保存失败，请先修正以下问题：</p>
          <ul className="space-y-1">
            {errors.map((error) => (
              <li key={error} className="text-[11px] text-red-200">
                {error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Model cards */}
      <div className="space-y-4">
        {localModels.map((model) => (
          <div key={model.draftKey} className="border border-[#222] bg-[#111]">
            {/* Card header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#222]">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => updateModel(model.draftKey, { enabled: !model.enabled })}
                  className="text-[#888] hover:text-white transition-colors"
                >
                  {model.enabled ? (
                    <ToggleRight size={20} className="text-emerald-400" />
                  ) : (
                    <ToggleLeft size={20} className="text-[#444]" />
                  )}
                </button>
	                <div>
	                  <h3 className="text-[13px] text-white">{model.name}</h3>
	                  <div className="flex items-center gap-2 mt-0.5">
	                    <span className="text-[8px] text-[#444] font-mono-data">配置: {model.id}</span>
	                    <p className="text-[9px] text-[#666] font-mono-data">{model.provider}</p>
	                    <span className="text-[8px] text-[#555] font-mono-data px-1.5 py-0.5 border border-[#333] bg-[#1a1a1a]">
	                      {PROTOCOL_OPTIONS.find(p => p.value === model.protocol)?.label || model.protocol}
	                    </span>
	                    <span className="text-[8px] text-[#444] font-mono-data">请求: {model.requestModelId}</span>
	                  </div>
	                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    void testModel(model);
                  }}
                  disabled={Boolean(testingKeys[model.draftKey] || deletingKeys[model.draftKey])}
                  className="flex items-center gap-1.5 text-[9px] font-mono-data px-2 py-1 border border-[#333] text-[#aaa] hover:text-white hover:border-white transition-colors disabled:opacity-50"
                  title="测试可用性"
                >
                  <Activity size={12} />
                  {testingKeys[model.draftKey] ? '测试中' : '测试'}
                </button>
                <button
                  onClick={() => {
                    void removeModel(model);
                  }}
                  disabled={Boolean(deletingKeys[model.draftKey] || testingKeys[model.draftKey])}
                  className="text-[#666] hover:text-red-400 transition-colors disabled:opacity-50"
                  title={model.isNew ? '移除未保存模型' : '删除模型配置'}
                >
                  <Trash2 size={14} />
                </button>
                <span className={`text-[9px] font-mono-data px-2 py-0.5 border ${
                  model.enabled
                    ? 'text-emerald-400 border-emerald-400/30'
                    : 'text-[#555] border-[#333]'
                }`}>
                  {model.enabled ? '已启用' : '已停用'}
                </span>
              </div>
            </div>

            {testResults[model.draftKey] && (
              <div className={`px-5 py-2 border-b border-[#222] text-[10px] font-mono-data ${
                testResults[model.draftKey].ok
	                  ? 'text-emerald-300 bg-emerald-400/5'
	                  : 'text-red-200 bg-red-400/5'
	              }`}>
	                <span className="text-[#777]">{model.id}</span>
	                <span className="text-[#777] mx-2">/</span>
	                <span>
	                  {testResults[model.draftKey].ok ? '测试通过' : '测试失败'}
	                </span>
                <span className="text-[#777] mx-2">/</span>
                <span>{testResults[model.draftKey].message}</span>
                {typeof testResults[model.draftKey].status !== 'undefined' && (
                  <span className="text-[#777] ml-2">HTTP {testResults[model.draftKey].status}</span>
                )}
                {testResults[model.draftKey].details && (
                  <div className="text-[#888] mt-1 break-all">
	                    {testResults[model.draftKey].details}
	                  </div>
	                )}
	                {testResults[model.draftKey].imageUrl && (
	                  <div className="mt-3 max-w-[220px] border border-[#222] bg-black">
	                    <img
	                      src={testResults[model.draftKey].imageUrl}
	                      alt={`${model.id} test preview`}
	                      className="block aspect-square w-full object-cover"
	                    />
	                  </div>
	                )}
	              </div>
	            )}

            {/* Card body */}
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Model Name */}
              <div>
                <label className="flex items-center gap-1.5 text-[10px] text-[#888] uppercase tracking-[0.15em] mb-2 font-mono-data">
                  显示名称
                </label>
                <input
                  type="text"
                  value={model.name}
                  onChange={e => updateModel(model.draftKey, { name: e.target.value })}
                  placeholder="GPT-Image-2"
                  className="w-full bg-transparent border border-[#333] text-white text-[12px] px-3 py-2.5 focus:border-white focus:outline-none placeholder:text-[#444] font-mono-data"
                />
              </div>

              {/* Config ID */}
              <div>
                <label className="flex items-center gap-1.5 text-[10px] text-[#888] uppercase tracking-[0.15em] mb-2 font-mono-data">
                  配置 ID
                </label>
                <input
                  type="text"
                  value={model.id}
                  readOnly
                  placeholder="mod_1713873600000_ab12cd"
                  className="w-full bg-[#0b0b0b] border border-[#222] text-[#777] text-[12px] px-3 py-2.5 focus:outline-none placeholder:text-[#444] font-mono-data"
                />
              </div>

              {/* Request Model ID */}
              <div>
                <label className="flex items-center gap-1.5 text-[10px] text-[#888] uppercase tracking-[0.15em] mb-2 font-mono-data">
                  请求模型 ID
                </label>
                <input
                  type="text"
                  value={model.requestModelId}
                  onChange={e => updateModel(model.draftKey, { requestModelId: e.target.value })}
                  placeholder="gpt-image-2"
                  className="w-full bg-transparent border border-[#333] text-white text-[12px] px-3 py-2.5 focus:border-white focus:outline-none placeholder:text-[#444] font-mono-data"
                />
              </div>

              {/* Provider */}
              <div>
                <label className="flex items-center gap-1.5 text-[10px] text-[#888] uppercase tracking-[0.15em] mb-2 font-mono-data">
                  Provider
                </label>
                <input
                  type="text"
                  value={model.provider}
                  onChange={e => updateModel(model.draftKey, { provider: e.target.value })}
                  placeholder="Custom API"
                  className="w-full bg-transparent border border-[#333] text-white text-[12px] px-3 py-2.5 focus:border-white focus:outline-none placeholder:text-[#444] font-mono-data"
                />
              </div>

              {/* API Key */}
              <div>
                <label className="flex items-center gap-1.5 text-[10px] text-[#888] uppercase tracking-[0.15em] mb-2 font-mono-data">
                  <Key size={10} />
                  API Key
                </label>
                <input
                  type="password"
                  value={model.apiKey}
                  onChange={e => updateModel(model.draftKey, { apiKey: e.target.value })}
                  placeholder={model.hasApiKey ? '留空表示保持当前密钥' : 'sk-...'}
                  className="w-full bg-transparent border border-[#333] text-white text-[12px] px-3 py-2.5 focus:border-white focus:outline-none placeholder:text-[#444] font-mono-data"
                />
                {model.hasApiKey && !model.apiKey && (
                  <p className="text-[9px] text-[#555] font-mono-data mt-2">
                    已存在服务端密钥
                  </p>
                )}
              </div>

              {/* API Endpoint */}
              <div>
                <label className="flex items-center gap-1.5 text-[10px] text-[#888] uppercase tracking-[0.15em] mb-2 font-mono-data">
                  <Globe size={10} />
                  API Endpoint
                </label>
                <input
                  type="text"
                  value={model.apiEndpoint}
                  onChange={e => updateModel(model.draftKey, { apiEndpoint: e.target.value })}
                  placeholder="https://api.example.com/v1"
                  className="w-full bg-transparent border border-[#333] text-white text-[12px] px-3 py-2.5 focus:border-white focus:outline-none placeholder:text-[#444] font-mono-data"
                />
              </div>

              {/* Protocol */}
              <div>
                <label className="flex items-center gap-1.5 text-[10px] text-[#888] uppercase tracking-[0.15em] mb-2 font-mono-data">
                  <Globe size={10} />
                  请求协议
                </label>
                <select
                  value={model.protocol}
                  onChange={e => updateModel(model.draftKey, { protocol: e.target.value as ApiProtocol })}
                  className="w-full bg-transparent border border-[#333] text-white text-[12px] px-3 py-2.5 focus:border-white focus:outline-none font-mono-data"
                >
                  {PROTOCOL_OPTIONS.map(p => (
                    <option key={p.value} value={p.value} className="bg-black">{p.label}</option>
                  ))}
                </select>
              </div>

              {/* Default Size */}
              <div>
                <label className="flex items-center gap-1.5 text-[10px] text-[#888] uppercase tracking-[0.15em] mb-2 font-mono-data">
                  <Sliders size={10} />
                  默认尺寸
                </label>
                <select
                  value={model.defaultSize}
                  onChange={e => updateModel(model.draftKey, { defaultSize: e.target.value })}
                  className="w-full bg-transparent border border-[#333] text-white text-[12px] px-3 py-2.5 focus:border-white focus:outline-none font-mono-data"
                >
                  {SIZE_OPTIONS.map(s => (
                    <option key={s} value={s} className="bg-black">{s}</option>
                  ))}
                </select>
              </div>

              {/* Max Tokens */}
              <div>
                <label className="flex items-center gap-1.5 text-[10px] text-[#888] uppercase tracking-[0.15em] mb-2 font-mono-data">
                  <Sliders size={10} />
                  Max Tokens
                </label>
                <input
                  type="number"
                  value={model.maxTokens}
                  onChange={e => updateModel(model.draftKey, { maxTokens: Number(e.target.value) })}
                  className="w-full bg-transparent border border-[#333] text-white text-[12px] px-3 py-2.5 focus:border-white focus:outline-none font-mono-data"
                />
              </div>

              {/* Temperature */}
              <div className="md:col-span-2">
                <div className="flex justify-between mb-2">
                  <label className="flex items-center gap-1.5 text-[10px] text-[#888] uppercase tracking-[0.15em] font-mono-data">
                    <Sliders size={10} />
                    Temperature
                  </label>
                  <span className="text-[10px] text-white font-mono-data">{model.temperature}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.1}
                  value={model.temperature}
                  onChange={e => updateModel(model.draftKey, { temperature: Number(e.target.value) })}
                  className="w-full h-[2px] appearance-none bg-[#333] accent-white cursor-pointer"
                />
                <div className="flex justify-between mt-1">
                  <span className="text-[9px] text-[#555] font-mono-data">0</span>
                  <span className="text-[9px] text-[#555] font-mono-data">1</span>
                  <span className="text-[9px] text-[#555] font-mono-data">2</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
