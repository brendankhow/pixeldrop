'use client';

import { useState } from 'react';
import { Zap } from 'lucide-react';
import type { Product } from '@/types';

export function BuyNowButton({ product }: { product: Product }) {
  const [loading, setLoading] = useState(false);

  if (!product.stripe_price_id) return null;

  async function handleBuyNow() {
    setLoading(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ stripe_price_id: product.stripe_price_id, quantity: 1, product_id: product.id, name: product.name }],
        }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      // fall through
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleBuyNow}
      disabled={loading}
      className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-fg text-page text-sm font-semibold hover:bg-fg/90 transition-colors min-h-[52px] disabled:opacity-60"
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-page/30 border-t-page rounded-full animate-spin" />
      ) : (
        <Zap size={16} />
      )}
      Buy Now
    </button>
  );
}
