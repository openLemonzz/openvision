import { useEffect, useState } from 'react';
import { AlertTriangle, Check, Globe, Save } from 'lucide-react';
import type { AppSettings } from '@/lib/types';

interface AdminSettingsProps {
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => Promise<AppSettings>;
}

export default function AdminSettings({ settings, onUpdateSettings }: AdminSettingsProps) {
  const [publicWebUrl, setPublicWebUrl] = useState(settings.publicWebUrl ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setPublicWebUrl(settings.publicWebUrl ?? '');
  }, [settings.publicWebUrl]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError('');

    try {
      const nextSettings = await onUpdateSettings({
        publicWebUrl: publicWebUrl.trim() || null,
      });
      setPublicWebUrl(nextSettings.publicWebUrl ?? '');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-[900px]">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h2 className="text-[14px] font-normal text-white tracking-[0.08em]">站点配置</h2>
          <p className="text-[10px] text-[#666] font-mono-data mt-1">
            管理邮件确认和密码重置使用的前台公开地址
          </p>
        </div>
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

      <div className="flex items-start gap-3 border border-amber-400/20 bg-amber-400/5 p-4 mb-6">
        <AlertTriangle size={14} className="text-amber-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-[11px] text-amber-400/80 leading-relaxed">
            这里填写用户实际访问 web 的公开域名。Supabase Authentication 的 Redirect URLs
            必须同时包含同一个 origin，否则邮件链接仍可能回退到 Supabase 后台默认地址。
          </p>
        </div>
      </div>

      {error && (
        <div className="border border-red-400/30 bg-red-400/5 p-4 mb-6">
          <p className="text-[11px] text-red-300 font-mono-data">{error}</p>
        </div>
      )}

      <div className="border border-[#222] bg-[#111] p-5 space-y-4">
        <div>
          <label className="flex items-center gap-1.5 text-[10px] text-[#888] uppercase tracking-[0.15em] mb-2 font-mono-data">
            <Globe size={10} />
            前台公开地址
          </label>
          <input
            type="text"
            value={publicWebUrl}
            onChange={(event) => setPublicWebUrl(event.target.value)}
            placeholder="https://vision.app"
            className="w-full bg-transparent border border-[#333] text-white text-[12px] px-3 py-2.5 focus:border-white focus:outline-none placeholder:text-[#444] font-mono-data"
          />
          <p className="text-[10px] text-[#666] font-mono-data mt-2 leading-relaxed">
            只接受绝对 http/https 地址。保存时系统会自动规范化为 origin，例如
            `https://vision.app/welcome?x=1` 会保存为 `https://vision.app`。
          </p>
        </div>
      </div>
    </div>
  );
}
