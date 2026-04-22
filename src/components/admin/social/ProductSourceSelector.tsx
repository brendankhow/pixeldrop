'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Upload, ChevronDown } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import type { SourceImage } from '@/components/admin/playground/UploadZone';
import type { Product } from '@/types';

interface ProductSourceSelectorProps {
  onSourceChanged: (source: SourceImage, productName: string | null, productSlug: string | null) => void;
}

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

export function ProductSourceSelector({ onSourceChanged }: ProductSourceSelectorProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const [loadingImage, setLoadingImage] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch active products from the admin API on mount
  useEffect(() => {
    fetch('/api/admin/products')
      .then((r) => r.json())
      .then((data: Product[]) => {
        const active = data.filter((p) => p.is_active && p.price > 0);
        setProducts(active);
      })
      .catch(() => { /* silently ignore — upload fallback still works */ })
      .finally(() => setLoadingProducts(false));
  }, []);

  // Load an HTMLImageElement from an object URL blob
  function loadImageFromUrl(objectUrl: string, w: number, h: number, file: File,
    productName: string | null, productSlug: string | null) {
    const img = new window.Image();
    img.onload = () => {
      onSourceChanged(
        { file, objectUrl, element: img, width: w, height: h },
        productName,
        productSlug,
      );
      setLoadingImage(false);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setLoadError('Failed to load image.');
      setLoadingImage(false);
    };
    img.crossOrigin = 'anonymous';
    img.src = objectUrl;
  }

  async function handleProductSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    setSelectedId(id);
    setLoadError('');
    if (!id) return;

    const product = products.find((p) => p.id === id);
    if (!product?.preview_image_url) {
      setLoadError('This product has no preview image.');
      return;
    }

    setLoadingImage(true);
    try {
      const res = await fetch(product.preview_image_url);
      if (!res.ok) throw new Error('fetch failed');
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);

      // Get dimensions via a temporary image
      const tempImg = new window.Image();
      tempImg.onload = () => {
        const syntheticFile = new File([blob], `${product.id}-preview.png`, { type: blob.type });
        loadImageFromUrl(objectUrl, tempImg.naturalWidth, tempImg.naturalHeight,
          syntheticFile, product.name, product.id);
      };
      tempImg.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        setLoadError('Failed to load image.');
        setLoadingImage(false);
      };
      tempImg.src = objectUrl;
    } catch {
      setLoadError('Could not load the product image. Try uploading it manually.');
      setLoadingImage(false);
    }
  }

  const processFile = useCallback((file: File) => {
    setUploadError('');
    if (!ACCEPTED.includes(file.type)) {
      setUploadError('Only JPG, PNG, and WebP files are accepted.');
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      onSourceChanged({ file, objectUrl, element: img, width: img.naturalWidth, height: img.naturalHeight },
        null, null);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setUploadError('Failed to load image.');
    };
    img.src = objectUrl;
  }, [onSourceChanged]);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }

  return (
    <div className="space-y-4">
      {/* Product dropdown */}
      <div className="bg-[#111111] border border-[#1F1F1F] rounded-2xl p-5 space-y-3">
        <div>
          <label className="text-sm font-medium text-[#EDEDED]">Load from product</label>
          <p className="text-xs text-[#6B7280] mt-0.5">Select an active product to use its preview image as the source.</p>
        </div>

        <div className="relative">
          {loadingProducts ? (
            <div className="flex items-center gap-2 text-sm text-[#6B7280] py-2">
              <Spinner size="sm" />
              Loading products…
            </div>
          ) : (
            <div className="relative">
              <select
                value={selectedId}
                onChange={handleProductSelect}
                disabled={loadingImage}
                className="w-full appearance-none bg-[#1a1a1a] border border-[#2D2D2D] rounded-lg px-3 py-2.5 pr-9 text-sm text-[#EDEDED] focus:outline-none focus:ring-2 focus:ring-[#5B21B6] disabled:opacity-50 cursor-pointer min-h-[44px]"
              >
                <option value="">— Select a product —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] pointer-events-none" />
            </div>
          )}
          {loadingImage && (
            <div className="flex items-center gap-2 mt-2 text-xs text-[#9CA3AF]">
              <Spinner size="sm" />
              Loading image…
            </div>
          )}
          {loadError && <p className="mt-2 text-xs text-red-400">{loadError}</p>}
        </div>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-[#1F1F1F]" />
        <span className="text-xs text-[#4B5563] font-medium">or upload your own</span>
        <div className="flex-1 h-px bg-[#1F1F1F]" />
      </div>

      {/* Manual upload zone */}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`w-full flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          isDragging
            ? 'border-[#5B21B6] bg-[#5B21B6]/10'
            : 'border-[#2D2D2D] bg-[#111111] hover:border-[#5B21B6]/50 hover:bg-[#5B21B6]/5'
        }`}
      >
        <div className="w-12 h-12 rounded-xl bg-[#5B21B6]/15 border border-[#5B21B6]/30 flex items-center justify-center">
          <Upload size={22} className="text-[#A78BFA]" />
        </div>
        <div>
          <p className="text-sm font-medium text-[#EDEDED]">Drop an image here</p>
          <p className="mt-1 text-xs text-[#6B7280]">
            or <span className="text-[#A78BFA] underline underline-offset-2">click to browse</span>
            {' '}· JPG · PNG · WebP
          </p>
        </div>
      </button>

      {uploadError && <p className="text-xs text-red-400">{uploadError}</p>}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ''; }}
      />
    </div>
  );
}
