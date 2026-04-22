'use client';

import { useEffect, useState } from 'react';
import { Share2 } from 'lucide-react';
import { ProductSourceSelector } from '@/components/admin/social/ProductSourceSelector';
import { SocialFormatTabs } from '@/components/admin/social/SocialFormatTabs';
import { CaptionPanel } from '@/components/admin/social/CaptionPanel';
import { QueueTab } from '@/components/admin/social/QueueTab';
import type { SourceImage } from '@/components/admin/playground/UploadZone';
import type { Product } from '@/types';

type MainTab = 'formats' | 'queue';

export default function SocialPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [productSlug, setProductSlug] = useState<string | null>(null);
  const [mainTab, setMainTab] = useState<MainTab>('formats');
  const [activeFormatTab, setActiveFormatTab] = useState<'instagram' | 'twitter'>('instagram');
  const [activeFormatSlug, setActiveFormatSlug] = useState('ig-square');
  const [queueRefreshKey, setQueueRefreshKey] = useState(0);

  // Fetch products for CaptionPanel selector
  useEffect(() => {
    fetch('/api/admin/products')
      .then((r) => r.json())
      .then((data: Product[]) => setProducts(data.filter((p) => p.is_active && p.price > 0)))
      .catch(() => {});
  }, []);

  function handleSourceChanged(
    source: SourceImage,
    _productName: string | null,
    slug: string | null,
  ) {
    setSourceImage(source.element);
    setProductSlug(slug);
    if (slug) {
      const match = products.find((p) => p.id === slug);
      if (match) setSelectedProductId(match.id);
    }
  }

  async function handleSaveToQueue(params: {
    product_id: string;
    platform: 'instagram' | 'twitter';
    format_slug: string;
    caption: string;
  }) {
    await fetch('/api/admin/social-queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    setQueueRefreshKey((k) => k + 1);
  }

  const filenamePrefix = productSlug ? `pixeldrop-${productSlug}` : 'pixeldrop-social';

  const activeFormatPlatform: 'instagram' | 'twitter' = activeFormatTab;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#5B21B6]/20 border border-[#5B21B6]/30 flex items-center justify-center shrink-0">
          <Share2 size={18} className="text-[#A78BFA]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[#EDEDED]">Social Content</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">
            Export images sized for Instagram and X / Twitter, then generate captions.
          </p>
        </div>
      </div>

      {/* Main tab bar */}
      <div className="flex items-center gap-1 bg-[#111111] border border-[#1F1F1F] rounded-xl p-1 w-fit">
        {(['formats', 'queue'] as MainTab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setMainTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
              mainTab === t
                ? 'bg-[#5B21B6] text-white'
                : 'text-[#9CA3AF] hover:text-[#EDEDED] hover:bg-[#1A1A1A]'
            }`}
          >
            {t === 'formats' ? 'Formats' : 'Queue'}
          </button>
        ))}
      </div>

      {mainTab === 'formats' ? (
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-8 items-start">
          {/* Left column: source + captions */}
          <div className="space-y-6 lg:sticky lg:top-8">
            <ProductSourceSelector onSourceChanged={handleSourceChanged} />
            <CaptionPanel
              products={products}
              selectedProductId={selectedProductId}
              onProductChange={setSelectedProductId}
              activePlatform={activeFormatPlatform}
              activeFormatSlug={activeFormatSlug}
              onSaveToQueue={handleSaveToQueue}
            />
          </div>

          {/* Right column: format tabs */}
          <SocialFormatTabs
            sourceImage={sourceImage}
            filenamePrefix={filenamePrefix}
            onTabChange={setActiveFormatTab}
            onActiveFormatSlugChange={setActiveFormatSlug}
          />
        </div>
      ) : (
        <QueueTab refreshKey={queueRefreshKey} />
      )}
    </div>
  );
}
