'use client';

import { useState } from 'react';
import Image from 'next/image';

interface ProductImageGalleryProps {
  images: string[];
  productName: string;
}

export function ProductImageGallery({ images, productName }: ProductImageGalleryProps) {
  const [active, setActive] = useState(0);

  if (images.length === 0) {
    return (
      <div className="relative w-full rounded-2xl overflow-hidden bg-card border border-edge aspect-[4/3]">
        <div className="absolute inset-0 flex items-center justify-center text-fg-faint text-sm">No preview available</div>
      </div>
    );
  }

  const thumbClass = 'w-20 h-16';

  return (
    <div className="space-y-3">
      {/* Main image */}
      <div className="relative w-full rounded-2xl overflow-hidden bg-card border border-edge aspect-[4/3]">
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
