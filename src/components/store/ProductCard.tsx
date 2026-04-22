'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Check, ShoppingCart } from 'lucide-react';
import { useState } from 'react';
import { useCartStore } from '@/lib/cart-store';
import { formatPrice } from '@/lib/utils';

const BADGE_STYLES: Record<string, { label: string; className: string }> = {
  new:        { label: 'NEW',         className: 'bg-teal-500/90 text-white' },
  trending:   { label: '🔥 HOT',      className: 'bg-orange-500/90 text-white' },
  bestseller: { label: '⭐ BESTSELLER', className: 'bg-amber-400/90 text-black' },
};
import { trackEvent } from '@/lib/tracking';
import type { Product } from '@/types';

const categoryLabels: Record<Product['category'], string> = {
  iphone: 'Smartphone',
  desktop: 'Desktop',
  bundle: 'Bundle',
  other: 'Other',
};

interface ProductCardProps {
  product: Product;
  priority?: boolean;
}

export function ProductCard({ product, priority = false }: ProductCardProps) {
  const { addItem, openCart } = useCartStore();
  const [added, setAdded] = useState(false);

  function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    addItem(product);
    setAdded(true);
    openCart();
    trackEvent('cart_add', { product_id: product.id, product_name: product.name });
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <Link
      href={`/products/${product.id}`}
      className="group relative flex flex-col rounded-2xl overflow-hidden bg-card border border-edge hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10"
    >
      <div className="relative w-full shrink-0 overflow-hidden bg-page-alt aspect-video">
        {product.preview_image_url ? (
          <Image
            src={product.preview_image_url}
            alt={product.name}
            fill
            priority={priority}
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-edge-2">
            <ShoppingCart size={40} />
          </div>
        )}
        <div className="absolute top-3 left-3">
          <span className="inline-flex items-center rounded-full bg-black/60 backdrop-blur-sm px-2.5 py-1 text-xs font-medium text-white border border-white/10">
            {categoryLabels[product.category]}
          </span>
        </div>
        {product.badge && BADGE_STYLES[product.badge] && (
          <div className="absolute top-3 right-3">
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold backdrop-blur-sm ${BADGE_STYLES[product.badge].className}`}>
              {BADGE_STYLES[product.badge].label}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col flex-1 p-4 gap-3">
        <div className="flex-1">
          <h3 className="font-semibold text-fg text-sm leading-snug line-clamp-2">
            {product.name}
          </h3>
          {product.description && (
            <p className="text-xs text-fg-faint mt-1 line-clamp-2">{product.description}</p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-2">
            {product.original_price && (
              <span className="text-sm text-fg-faint line-through">{formatPrice(product.original_price)}</span>
            )}
            <span className={`text-lg font-bold ${product.original_price ? 'text-emerald-400' : 'text-fg'}`}>
              {formatPrice(product.price)}
            </span>
          </div>
          <button
            onClick={handleAddToCart}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold min-h-[44px] transition-all duration-200 ${
              added ? 'bg-emerald-600 text-white' : 'bg-primary text-white hover:bg-primary-h active:bg-[#4C1D95]'
            }`}
            aria-label={added ? 'Added to cart' : `Add ${product.name} to cart`}
          >
            {added ? <><Check size={14} />Added</> : <><ShoppingCart size={14} />Add</>}
          </button>
        </div>
      </div>
    </Link>
  );
}
