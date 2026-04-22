'use client';

import { useState } from 'react';
import Image from 'next/image';

interface ProductImageGalleryProps {
  images: string[];
  productName: string;
  category?: string;
}

export function ProductImageGallery({ images, productName, category }: ProductImageGalleryProps) {
  const [active, setActive] = useState(0);

  const mainFrameClass =
    category === 'iphone'
      ? 'relative w-full rounded-[2.5rem] overflow-hidden bg-card border-[3px] border-[#333] aspect-[4/3]'
      : category === 'desktop'
      ? 'relative w-full rounded-xl overflow-hidden bg-card border-[4px] border-[#444] aspect-[4/3]'
      : 'relative w-full rounded-2xl overflow-hidden bg-card border border-edge aspect-[4/3]';

  if (images.length === 0) {
    return (
      <div className={mainFrameClass}>
        <div className="absolute inset-0 flex items-center justify-center text-fg-faint text-sm">No preview available</div>
      </div>
    );
  }

  const thumbClass = 'w-20 h-16';

  return (
    <div className="space-y-3">
      {/* Main image — styled frame depends on category */}
      <div>
        <div className={mainFrameClass}>
          <Image
            key={active}
            src={images[active]}
            alt={productName}
            fill
            priority
            className="object-cover"
            sizes="(max-width: 1024px) 100vw, 50vw"
          />
        </div>
        {/* Minimal monitor stand for desktop category */}
        {category === 'desktop' && (
          <div className="flex flex-col items-center mt-0.5">
            <div className="w-12 h-3 bg-[#2a2a2a]" />
            <div className="w-24 h-1.5 bg-[#222] rounded-full" />
          </div>
        )}
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-2.5 overflow-x-auto pb-1">
          {images.map((url, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              className={`relative shrink-0 ${thumbClass} rounded-xl overflow-hidden border-2 transition-all duration-200 ${
                i === active
                  ? 'border-primary opacity-100 shadow-md shadow-primary/20'
                  : 'border-edge opacity-55 hover:opacity-100 hover:border-edge-2'
              }`}
            >
              <Image src={url} alt={`${productName} view ${i + 1}`} fill className="object-cover" sizes="80px" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
