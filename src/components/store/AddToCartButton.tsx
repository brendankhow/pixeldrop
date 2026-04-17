'use client';

import { useState } from 'react';
import { Check, ShoppingCart } from 'lucide-react';
import { useCartStore } from '@/lib/cart-store';
import { Button } from '@/components/ui/Button';
import type { Product } from '@/types';

export function AddToCartButton({ product }: { product: Product }) {
  const { addItem, openCart } = useCartStore();
  const [added, setAdded] = useState(false);

  function handleAdd() {
    addItem(product);
    openCart();
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <Button
      variant="primary"
      size="lg"
      onClick={handleAdd}
      className="flex-1 sm:flex-none gap-2"
    >
      {added ? (
        <>
          <Check size={18} />
          Added to Cart!
        </>
      ) : (
        <>
          <ShoppingCart size={18} />
          Add to Cart — ${(product.price / 100).toFixed(2)}
        </>
      )}
    </Button>
  );
}
