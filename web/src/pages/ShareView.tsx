import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Share, ExternalLink, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { adminFetch } from '@/lib/admin-api';
import { buildPublicSharePath } from '@/lib/share-links';

interface SharedGeneration {
  id: string;
  prompt: string;
  aspectRatio: string;
  styleStrength: number;
  engine: string;
  imageUrl: string;
  createdAt: number;
  status: string;
  creatorInviteCode?: string | null;
}

export default function ShareView({
  onTryYourself
}: {
  onTryYourself: (prompt: string, aspectRatio: '1:1' | '16:9' | '3:4' | '9:16', styleStrength: number, engine: string, inviteCode?: string) => void;
}) {
  const { shareCode } = useParams<{ shareCode: string }>();
  const [data, setData] = useState<SharedGeneration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shareCode) return;

    let active = true;
    const fetchShare = async () => {
      try {
        const json = await adminFetch<SharedGeneration>(buildPublicSharePath(shareCode));
        if (active) {
          setData(json);
          setLoading(false);
        }
      } catch {
        if (active) {
          setError('分享已过期或不存在');
          setLoading(false);
        }
      }
    };

    void fetchShare();
    return () => { active = false; };
  }, [shareCode]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center font-mono-data">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center font-mono-data">
        <div className="text-center">
          <div className="text-2xl mb-4">:(</div>
          <div className="text-zinc-500">{error || '分享不存在'}</div>
        </div>
      </div>
    );
  }

  const copyPrompt = () => {
    void navigator.clipboard.writeText(data.prompt);
    toast.success('已复制提示词');
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col md:flex-row font-mono-data">
      {/* Left side: Image Display */}
      <div className="flex-1 flex items-center justify-center bg-zinc-950 p-4 md:p-8 min-h-[50vh]">
        <img
          src={data.imageUrl}
          alt={data.prompt}
          className="max-w-full max-h-[80vh] md:max-h-[90vh] object-contain rounded-sm shadow-2xl"
        />
      </div>

      {/* Right side: Metadata Panel */}
      <div className="w-full md:w-[400px] lg:w-[480px] bg-zinc-900 border-l border-zinc-800 p-6 md:p-10 flex flex-col overflow-y-auto">
        <div className="mb-8">
          <h2 className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Generated Image</h2>
          <div className="flex items-center gap-2">
            <Share className="w-4 h-4 text-zinc-400" />
            <span className="text-zinc-300 font-bold">Shared Showcase</span>
          </div>
        </div>

        <div className="space-y-8 flex-1">
          {/* Prompt Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs uppercase tracking-widest text-zinc-500">Prompt</h3>
              <button onClick={copyPrompt} className="text-zinc-400 hover:text-white transition-colors" title="Copy Prompt">
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <div className="text-sm leading-relaxed text-zinc-300 bg-black/40 p-4 rounded-sm border border-zinc-800">
              {data.prompt}
            </div>
          </div>

          {/* Parameters Section */}
          <div className="space-y-4">
            <h3 className="text-xs uppercase tracking-widest text-zinc-500">Parameters</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-black/40 p-3 border border-zinc-800 rounded-sm">
                <div className="text-xs text-zinc-500 mb-1">Aspect Ratio</div>
                <div className="text-sm">{data.aspectRatio}</div>
              </div>
              <div className="bg-black/40 p-3 border border-zinc-800 rounded-sm">
                <div className="text-xs text-zinc-500 mb-1">Style Strength</div>
                <div className="text-sm">{data.styleStrength}%</div>
              </div>
              <div className="bg-black/40 p-3 border border-zinc-800 rounded-sm col-span-2">
                <div className="text-xs text-zinc-500 mb-1">Model Engine</div>
                <div className="text-sm">{data.engine}</div>
              </div>
              <div className="bg-black/40 p-3 border border-zinc-800 rounded-sm col-span-2">
                <div className="text-xs text-zinc-500 mb-1">Generated At</div>
                <div className="text-sm">{new Date(data.createdAt).toLocaleString()}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Section */}
        <div className="pt-8 mt-8 border-t border-zinc-800">
          <button
            onClick={() => onTryYourself(data.prompt, data.aspectRatio as '1:1' | '16:9' | '3:4' | '9:16', data.styleStrength, data.engine, data.creatorInviteCode || undefined)}
            className="w-full bg-white text-black font-bold h-12 flex items-center justify-center gap-2 hover:bg-zinc-200 transition-colors uppercase tracking-widest text-sm"
          >
            <ExternalLink className="w-4 h-4" />
            Try It Yourself
          </button>
        </div>
      </div>
    </div>
  );
}
