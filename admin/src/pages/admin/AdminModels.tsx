import { useEffect, useState } from 'react';
import { Save, Key, Globe, Sliders, ToggleLeft, ToggleRight, AlertTriangle, Check } from 'lucide-react';
import type { ApiProtocol, ModelConfig } from '@/lib/types';

interface AdminModelsProps {
  models: ModelConfig[];
  onUpdateModels: (models: ModelConfig[]) => void;
}

const SIZE_OPTIONS = ['1024x1024', '1024x576', '768x1024', '576x1024', '1792x1024', '1024x1792'];

const PROTOCOL_OPTIONS: { value: ApiProtocol; label: string }[] = [
  { value: 'openai', label: 'OpenAI 兼容' },
  { value: 'midjourney', label: 'Midjourney' },
  { value: 'stability', label: 'Stability AI' },
  { value: 'custom', label: '自定义 / 其他' },
];

export default function AdminModels({ models, onUpdateModels }: AdminModelsProps) {
  const [localModels, setLocalModels] = useState<ModelConfig[]>(models);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLocalModels(models);
  }, [models]);

  const updateModel = (id: string, updates: Partial<ModelConfig>) => {
    setLocalModels(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
    setSaved(false);
  };

  const handleSave = () => {
    onUpdateModels(localModels);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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
        <button
          onClick={handleSave}
          className={`flex items-center gap-2 px-5 py-2.5 text-[11px] uppercase tracking-[0.12em] font-mono-data transition-all ${
            saved
              ? 'bg-emerald-500 text-white'
              : 'bg-white text-black hover:bg-[#e0e0e0]'
          }`}
        >
          {saved ? <Check size={13} /> : <Save size={13} />}
          {saved ? '已保存' : '保存配置'}
        </button>
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

      {/* Model cards */}
      <div className="space-y-4">
        {localModels.map((model, index) => (
          <div key={index} className="border border-[#222] bg-[#111]">
            {/* Card header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#222]">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => updateModel(model.id, { enabled: !model.enabled })}
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
                    <p className="text-[9px] text-[#666] font-mono-data">{model.provider}</p>
                    <span className="text-[8px] text-[#555] font-mono-data px-1.5 py-0.5 border border-[#333] bg-[#1a1a1a]">
                      {PROTOCOL_OPTIONS.find(p => p.value === model.protocol)?.label || model.protocol}
                    </span>
                    <span className="text-[8px] text-[#444] font-mono-data">ID: {model.id}</span>
                  </div>
                </div>
              </div>
              <span className={`text-[9px] font-mono-data px-2 py-0.5 border ${
                model.enabled
                  ? 'text-emerald-400 border-emerald-400/30'
                  : 'text-[#555] border-[#333]'
              }`}>
                {model.enabled ? '已启用' : '已停用'}
              </span>
            </div>

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
                  onChange={e => updateModel(model.id, { name: e.target.value })}
                  placeholder="GPT-Image-2"
                  className="w-full bg-transparent border border-[#333] text-white text-[12px] px-3 py-2.5 focus:border-white focus:outline-none placeholder:text-[#444] font-mono-data"
                />
              </div>

              {/* Model ID */}
              <div>
                <label className="flex items-center gap-1.5 text-[10px] text-[#888] uppercase tracking-[0.15em] mb-2 font-mono-data">
                  请求模型 ID
                </label>
                <input
                  type="text"
                  value={model.id}
                  onChange={e => updateModel(model.id, { id: e.target.value })}
                  placeholder="gpt-image-2"
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
                  onChange={e => updateModel(model.id, { apiKey: e.target.value })}
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
                  onChange={e => updateModel(model.id, { apiEndpoint: e.target.value })}
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
                  onChange={e => updateModel(model.id, { protocol: e.target.value as ApiProtocol })}
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
                  onChange={e => updateModel(model.id, { defaultSize: e.target.value })}
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
                  onChange={e => updateModel(model.id, { maxTokens: Number(e.target.value) })}
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
                  onChange={e => updateModel(model.id, { temperature: Number(e.target.value) })}
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
