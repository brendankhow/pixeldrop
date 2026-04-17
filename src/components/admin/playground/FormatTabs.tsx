'use client';

import { useState } from 'react';
import { Copy } from 'lucide-react';
import { FormatCard, type CropState, DEFAULT_CROP } from './FormatCard';

// ── Format definitions ─────────────────────────────────────────────────────────

interface FormatConfig {
  label: string;
  slug: string;
  w: number;
  h: number;
}

const SMARTPHONE_FORMATS: FormatConfig[] = [
  { label: 'iPhone 16 Pro Max · 1320 × 2868',         slug: 'iphone16promax',  w: 1320, h: 2868 },
  { label: 'iPhone 16 Pro · 1206 × 2622',              slug: 'iphone16pro',     w: 1206, h: 2622 },
  { label: 'iPhone 16 / 16 Plus · 1179 × 2556',        slug: 'iphone16',        w: 1179, h: 2556 },
  { label: 'iPhone 15 Pro Max · 1290 × 2796',          slug: 'iphone15promax',  w: 1290, h: 2796 },
  { label: 'Samsung Galaxy S25 Ultra · 1440 × 3088',   slug: 's25ultra',        w: 1440, h: 3088 },
  { label: 'Samsung Galaxy S25+ · 1440 × 3120',        slug: 's25plus',         w: 1440, h: 3120 },
  { label: 'Samsung Galaxy S25 · 1080 × 2340',         slug: 's25',             w: 1080, h: 2340 },
];

const DESKTOP_FORMATS: FormatConfig[] = [
  { label: '4K UHD Universal · 3840 × 2160', slug: 'desktop4k', w: 3840, h: 2160 },
];

const POSTER_FORMATS: FormatConfig[] = [
  { label: '4K Portrait Poster · 2160 × 3840', slug: 'poster4k', w: 2160, h: 3840 },
];

const TABS = [
  { label: 'Smartphones', formats: SMARTPHONE_FORMATS },
  { label: 'Desktop',     formats: DESKTOP_FORMATS },
  { label: 'Posters',     formats: POSTER_FORMATS },
];

// ── Component ──────────────────────────────────────────────────────────────────

interface FormatTabsProps {
  sourceImage: HTMLImageElement | null;
  cropStates: Record<string, CropState>;
  onCropChange: (slug: string, state: CropState) => void;
}

export function FormatTabs({ sourceImage, cropStates, onCropChange }: FormatTabsProps) {
  const [activeTab, setActiveTab] = useState(0);

  const { formats } = TABS[activeTab];

  function getCropState(slug: string): CropState {
    return cropStates[slug] ?? DEFAULT_CROP;
  }

  function handleCopyCropToAll() {
    const firstSlug = formats[0].slug;
    const firstState = getCropState(firstSlug);
    formats.slice(1).forEach((f) => onCropChange(f.slug, { ...firstState }));
  }

  return (
    <div className="space-y-5">

      {/* Tab bar */}
      <div className="flex items-center gap-2">
        {TABS.map((tab, i) => (
          <button
            key={tab.label}
            type="button"
            onClick={() => setActiveTab(i)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors min-h-[36px] ${
              i === activeTab
                ? 'bg-[#5B21B6]/20 text-[#A78BFA] border border-[#5B21B6]/30'
                : 'text-[#9CA3AF] hover:text-[#EDEDED] hover:bg-[#1A1A1A] border border-transparent'
            }`}
          >
            {tab.label}
            <span className="ml-1.5 text-[10px] opacity-60">({tab.formats.length})</span>
          </button>
        ))}
      </div>

      {/* Copy crop to all — only shown when more than one format in tab */}
      {formats.length > 1 && (
        <div className="flex items-center justify-between py-2 border-b border-[#1F1F1F]">
          <p className="text-xs text-[#6B7280]">
            Adjust one card, then copy the same crop to all others in this tab.
          </p>
          <button
            type="button"
            onClick={handleCopyCropToAll}
            disabled={!sourceImage}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#9CA3AF] hover:text-[#EDEDED] hover:bg-[#1A1A1A] border border-[#2D2D2D] hover:border-[#3D3D3D] transition-colors disabled:opacity-30 disabled:pointer-events-none whitespace-nowrap"
          >
            <Copy size={12} />
            Copy crop to all
          </button>
        </div>
      )}

      {/* Format card grid */}
      <div className={`grid gap-4 ${formats.length === 1 ? 'grid-cols-1 max-w-xs' : 'grid-cols-1 sm:grid-cols-2'}`}>
        {formats.map((fmt) => (
          <FormatCard
            key={fmt.slug}
            sourceImage={sourceImage}
            targetWidth={fmt.w}
            targetHeight={fmt.h}
            label={fmt.label}
            slug={fmt.slug}
            cropState={getCropState(fmt.slug)}
            onCropChange={onCropChange}
          />
        ))}
      </div>

    </div>
  );
}
