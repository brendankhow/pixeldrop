'use client';

import { useState } from 'react';
import { Sparkles, Copy, Check, Save } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import type { Product } from '@/types';

interface CaptionVariant {
  caption: string;
  hashtags: string;
}

type Platform = 'instagram' | 'twitter';
type Tone = 'aesthetic' | 'hype' | 'minimal' | 'story';

interface CaptionPanelProps {
  products: Product[];
  selectedProductId: string;
  onProductChange: (id: string) => void;
  activePlatform: Platform;
  activeFormatSlug: string;
  onSaveToQueue: (params: {
    product_id: string;
    platform: Platform;
    format_slug: string;
    caption: string;
  }) => Promise<void>;
}

const TONES: { value: Tone; label: string }[] = [
  { value: 'aesthetic', label: 'Aesthetic' },
  { value: 'hype',      label: 'Hype' },
  { value: 'minimal',   label: 'Minimal' },
  { value: 'story',     label: 'Story' },
];

export function CaptionPanel({
  products,
  selectedProductId,
  onProductChange,
  activePlatform,
  activeFormatSlug,
  onSaveToQueue,
}: CaptionPanelProps) {
  const [platform, setPlatform] = useState<Platform>(activePlatform);
  const [tone, setTone] = useState<Tone>('aesthetic');
  const [variants, setVariants] = useState<CaptionVariant[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [savingIdx, setSavingIdx] = useState<number | null>(null);
  const [savedIdx, setSavedIdx] = useState<number | null>(null);

  const canGenerate = !!selectedProductId;

  async function handleGenerate() {
    if (!canGenerate) return;
    setGenerating(true);
    setError('');
    setVariants([]);

    try {
      const res = await fetch('/api/admin/generate-captions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: selectedProductId, platform, tone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Generation failed');
      setVariants(data.variants ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate captions');
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopy(idx: number) {
    const v = variants[idx];
    if (!v) return;
    await navigator.clipboard.writeText(`${v.caption}\n\n${v.hashtags}`);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  }

  async function handleSave(idx: number) {
    const v = variants[idx];
    if (!v || !selectedProductId) return;
    setSavingIdx(idx);
    try {
      await onSaveToQueue({
        product_id: selectedProductId,
        platform,
        format_slug: activeFormatSlug,
        caption: `${v.caption}\n\n${v.hashtags}`,
      });
      setSavedIdx(idx);
      setTimeout(() => setSavedIdx(null), 2000);
    } finally {
      setSavingIdx(null);
    }
  }

  return (
    <div className="bg-[#111111] border border-[#1F1F1F] rounded-2xl p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkles size={16} className="text-[#A78BFA]" />
        <h2 className="text-sm font-semibold text-[#EDEDED]">Caption Generator</h2>
      </div>

      {/* Product selector */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-[#9CA3AF]">Product</label>
        <select
          value={selectedProductId}
          onChange={(e) => onProductChange(e.target.value)}
          className="w-full appearance-none bg-[#1a1a1a] border border-[#2D2D2D] rounded-lg px-3 py-2 text-sm text-[#EDEDED] focus:outline-none focus:ring-2 focus:ring-[#5B21B6] cursor-pointer"
        >
          <option value="">— Select a product —</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Platform toggle */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-[#9CA3AF]">Platform</label>
        <div className="flex gap-1">
          {(['instagram', 'twitter'] as Platform[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPlatform(p)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                platform === p
                  ? 'bg-[#5B21B6] text-white'
                  : 'bg-[#1a1a1a] border border-[#2D2D2D] text-[#9CA3AF] hover:text-[#EDEDED]'
              }`}
            >
              {p === 'instagram' ? 'Instagram' : 'X / Twitter'}
            </button>
          ))}
        </div>
      </div>

      {/* Tone selector */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-[#9CA3AF]">Tone</label>
        <div className="grid grid-cols-2 gap-1">
          {TONES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setTone(value)}
              className={`py-1.5 rounded-lg text-xs font-medium transition-colors ${
                tone === value
                  ? 'bg-[#5B21B6]/30 border border-[#5B21B6]/60 text-[#A78BFA]'
                  : 'bg-[#1a1a1a] border border-[#2D2D2D] text-[#9CA3AF] hover:text-[#EDEDED]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Generate button */}
      <button
        type="button"
        onClick={handleGenerate}
        disabled={!canGenerate || generating}
        className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
          generating
            ? 'bg-[#5B21B6]/60 text-white cursor-wait'
            : canGenerate
            ? 'bg-[#5B21B6] hover:bg-[#6D28D9] text-white'
            : 'bg-[#1A1A1A] border border-[#2D2D2D] text-[#4B5563] cursor-not-allowed'
        }`}
      >
        {generating ? (
          <><Spinner size="sm" className="border-white border-t-transparent" />Generating…</>
        ) : (
          <><Sparkles size={14} />✦ Generate Captions</>
        )}
      </button>

      {!canGenerate && (
        <p className="text-xs text-[#6B7280] text-center -mt-2">Select a product above to generate captions</p>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* Variants */}
      {variants.length > 0 && (
        <div className="space-y-4 pt-1">
          {variants.map((v, i) => (
            <div key={i} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#6B7280]">Variant {i + 1}</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleSave(i)}
                    disabled={savingIdx === i}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors ${
                      savedIdx === i
                        ? 'bg-emerald-600/20 border border-emerald-600/40 text-emerald-400'
                        : 'bg-[#1a1a1a] border border-[#2D2D2D] text-[#9CA3AF] hover:text-[#EDEDED] hover:border-[#3D3D3D]'
                    }`}
                  >
                    {savingIdx === i ? (
                      <Spinner size="sm" />
                    ) : savedIdx === i ? (
                      <><Check size={10} />Saved</>
                    ) : (
                      <><Save size={10} />Save</>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopy(i)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors ${
                      copiedIdx === i
                        ? 'bg-emerald-600/20 border border-emerald-600/40 text-emerald-400'
                        : 'bg-[#1a1a1a] border border-[#2D2D2D] text-[#9CA3AF] hover:text-[#EDEDED] hover:border-[#3D3D3D]'
                    }`}
                  >
                    {copiedIdx === i ? <><Check size={10} />Copied</> : <><Copy size={10} />Copy</>}
                  </button>
                </div>
              </div>
              <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-xl p-3 text-xs text-[#9CA3AF] whitespace-pre-wrap leading-relaxed">
                {v.caption}
              </div>
              {v.hashtags && (
                <p className="text-[11px] text-[#5B21B6] leading-relaxed">{v.hashtags}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
