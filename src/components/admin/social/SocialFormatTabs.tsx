'use client';

import { useState, useCallback } from 'react';
import { Copy } from 'lucide-react';
import { FormatCard, DEFAULT_CROP } from '@/components/admin/playground/FormatCard';
import { BatchDownloadButton } from '@/components/admin/playground/BatchDownloadButton';
import { INSTAGRAM_FORMATS, TWITTER_FORMATS, ALL_SOCIAL_FORMATS } from '@/lib/social/formats';
import type { CropState } from '@/components/admin/playground/FormatCard';

interface SocialFormatTabsProps {
  sourceImage: HTMLImageElement | null;
  filenamePrefix: string;
  onTabChange?: (tab: 'instagram' | 'twitter') => void;
  onActiveFormatSlugChange?: (slug: string) => void;
}

type Tab = 'instagram' | 'twitter';

function buildInitialCrops() {
  const crops: Record<string, CropState> = {};
  for (const fmt of ALL_SOCIAL_FORMATS) crops[fmt.slug] = DEFAULT_CROP;
  return crops;
}

export function SocialFormatTabs({
  sourceImage,
  filenamePrefix,
  onTabChange,
  onActiveFormatSlugChange,
}: SocialFormatTabsProps) {
  const [tab, setTab] = useState<Tab>('instagram');
  const [cropStates, setCropStates] = useState<Record<string, CropState>>(buildInitialCrops);

  const handleCropChange = useCallback((slug: string, state: CropState) => {
    setCropStates((prev) => ({ ...prev, [slug]: state }));
  }, []);

  function copyCurrentTabCropToAll() {
    const formats = tab === 'instagram' ? INSTAGRAM_FORMATS : TWITTER_FORMATS;
    const firstSlug = formats[0]?.slug;
    if (!firstSlug) return;
    const source = cropStates[firstSlug] ?? DEFAULT_CROP;
    setCropStates((prev) => {
      const next = { ...prev };
      for (const fmt of formats) next[fmt.slug] = source;
      return next;
    });
  }

  const activeFormats = tab === 'instagram' ? INSTAGRAM_FORMATS : TWITTER_FORMATS;
  const activeZip = tab === 'instagram'
    ? `${filenamePrefix}-instagram.zip`
    : `${filenamePrefix}-twitter.zip`;

  return (
    <div className="space-y-5">
      {/* Tab bar */}
      <div className="flex items-center gap-1 bg-[#111111] border border-[#1F1F1F] rounded-xl p-1 w-fit">
        {(['instagram', 'twitter'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTab(t);
              onTabChange?.(t);
              const firstSlug = (t === 'instagram' ? INSTAGRAM_FORMATS : TWITTER_FORMATS)[0]?.slug;
              if (firstSlug) onActiveFormatSlugChange?.(firstSlug);
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t
                ? 'bg-[#5B21B6] text-white'
                : 'text-[#9CA3AF] hover:text-[#EDEDED] hover:bg-[#1A1A1A]'
            }`}
          >
            {t === 'instagram' ? 'Instagram' : 'X / Twitter'}
          </button>
        ))}
      </div>

      {/* Format cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeFormats.map((fmt) => (
          <FormatCard
            key={fmt.slug}
            sourceImage={sourceImage}
            targetWidth={fmt.w}
            targetHeight={fmt.h}
            label={fmt.label}
            slug={fmt.slug}
            cropState={cropStates[fmt.slug] ?? DEFAULT_CROP}
            onCropChange={handleCropChange}
            filenamePrefix={filenamePrefix}
          />
        ))}
      </div>

      {/* Tab actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={copyCurrentTabCropToAll}
          disabled={!sourceImage}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium text-[#9CA3AF] hover:text-[#EDEDED] bg-[#111111] border border-[#1F1F1F] hover:border-[#2D2D2D] transition-colors disabled:opacity-30 disabled:pointer-events-none"
        >
          <Copy size={13} />
          Copy first crop to all {tab === 'instagram' ? 'Instagram' : 'Twitter'} formats
        </button>

        <div className="flex-1 min-w-[200px]">
          <BatchDownloadButton
            sourceImage={sourceImage}
            formats={activeFormats}
            cropStates={cropStates}
            zipFilename={activeZip}
            label={`Download ${tab === 'instagram' ? 'Instagram' : 'Twitter'} Pack`}
            filenamePrefix={filenamePrefix}
          />
        </div>
      </div>

      {/* Download all */}
      <div className="border-t border-[#1F1F1F] pt-5">
        <BatchDownloadButton
          sourceImage={sourceImage}
          formats={ALL_SOCIAL_FORMATS}
          cropStates={cropStates}
          zipFilename={`${filenamePrefix}-all-formats.zip`}
          label="Download All 5 Formats"
          prominent
          filenamePrefix={filenamePrefix}
        />
      </div>
    </div>
  );
}
