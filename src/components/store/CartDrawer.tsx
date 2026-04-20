'use client';

import * as Dialog from '@radix-ui/react-dialog';
import Image from 'next/image';
import { X, Minus, Plus, ShoppingBag, AlertTriangle } from 'lucide-react';
import { useCartStore } from '@/lib/cart-store';
import { formatPrice } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useState } from 'react';

export function CartDrawer() {
  const { items, isOpen, closeCart, removeItem, updateQuantity, getTotal, clearCart } =
    useCartStore();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  const total = getTotal();
  const isEmpty = items.length === 0;

  // Items that cannot proceed to checkout (no stripe_price_id yet)
  const unpricedItems = items.filter((i) => !i.product.stripe_price_id);
  const hasUnpriced = unpricedItems.length > 0;
  const checkoutableItems = items.filter((i) => i.product.stripe_price_id);
  const canCheckout = checkoutableItems.length > 0;

  async function handleCheckout() {
    setIsCheckingOut(true);
    setCheckoutError('');
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((i) => ({
            stripe_price_id: i.product.stripe_price_id,
            quantity: i.quantity,
            product_id: i.product.id,
            name: i.product.name,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Checkout failed');
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      setCheckoutError(
        err instanceof Error ? err.message : 'Checkout failed, please try again'
      );
    } finally {
      setIsCheckingOut(false);
    }
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && closeCart()}>
      <Dialog.Portal>
        {/* Backdrop */}
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        {/* Drawer panel */}
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed right-0 top-0 z-50 h-full w-full max-w-md bg-card border-l border-edge shadow-2xl flex flex-col data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right duration-300"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-edge">
            <Dialog.Title className="text-lg font-semibold text-fg">
              Your Cart{' '}
              {!isEmpty && (
                <span className="text-sm font-normal text-fg-muted">
                  ({items.reduce((s, i) => s + i.quantity, 0)} items)
                </span>
              )}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                className="rounded-lg p-2 text-fg-muted hover:text-fg hover:bg-edge transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Close cart"
              >
                <X size={20} />
              </button>
            </Dialog.Close>
          </div>

          {/* Cart items — scrollable */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {isEmpty ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                <ShoppingBag size={48} className="text-edge-2" />
                <div>
                  <p className="text-fg font-medium">Your cart is empty.</p>
                  <p className="text-fg-muted text-sm mt-1">Start shopping ↑</p>
                </div>
                <Dialog.Close asChild>
                  <Button variant="secondary" size="md">
                    Browse Products
                  </Button>
                </Dialog.Close>
              </div>
            ) : (
              <>
                {/* Warning banner for items without stripe_price_id */}
                {hasUnpriced && (
                  <div className="mb-4 flex gap-3 rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3">
                    <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-300 leading-relaxed">
                      <span className="font-semibold">
                        {unpricedItems.length === 1
                          ? `"${unpricedItems[0].product.name}"`
                          : `${unpricedItems.length} items`}{' '}
                      </span>
                      {unpricedItems.length === 1 ? 'hasn\'t' : 'haven\'t'} been priced yet
                      and will be skipped at checkout.
                    </p>
                  </div>
                )}

                <ul className="flex flex-col gap-4">
                  {items.map(({ product, quantity }) => (
                    <li
                      key={product.id}
                      className="flex gap-4 py-4 border-b border-edge last:border-0"
                    >
                      {/* Thumbnail */}
                      <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-edge shrink-0">
                        {product.preview_image_url ? (
                          <Image
                            src={product.preview_image_url}
                            alt={product.name}
                            fill
                            className="object-cover"
                            sizes="64px"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-edge-2">
                            <ShoppingBag size={20} />
                          </div>
                        )}
                        {/* Dim items that can't be purchased */}
                        {!product.stripe_price_id && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <span className="text-[10px] text-amber-400 font-bold text-center px-1">
                              Not ready
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-fg truncate">
                          {product.name}
                        </p>
                        <p className="text-sm text-fg-muted mt-0.5">
                          {formatPrice(product.price)}
                        </p>

                        {/* Quantity + remove */}
                        <div className="flex items-center gap-3 mt-2">
                          <div className="flex items-center gap-1 bg-card-alt rounded-lg border border-edge-2">
                            <button
                              onClick={() => updateQuantity(product.id, quantity - 1)}
                              className="p-1.5 text-fg-muted hover:text-fg transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                              aria-label="Decrease quantity"
                            >
                              <Minus size={14} />
                            </button>
                            <span className="text-sm font-medium text-fg w-6 text-center">
                              {quantity}
                            </span>
                            <button
                              onClick={() => updateQuantity(product.id, quantity + 1)}
                              className="p-1.5 text-fg-muted hover:text-fg transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                              aria-label="Increase quantity"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                          <button
                            onClick={() => removeItem(product.id)}
                            className="text-xs text-fg-faint hover:text-red-400 transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      {/* Line total */}
                      <p className="text-sm font-semibold text-fg shrink-0">
                        {formatPrice(product.price * quantity)}
                      </p>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {/* Footer — fixed at bottom */}
          {!isEmpty && (
            <div className="border-t border-edge px-6 py-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-fg-muted">Subtotal</span>
                <span className="text-xl font-bold text-fg">
                  {formatPrice(total)}
                </span>
              </div>

              {checkoutError && (
                <p className="text-sm text-red-400 text-center">{checkoutError}</p>
              )}

              <Button
                variant="primary"
                size="lg"
                className="w-full"
                onClick={handleCheckout}
                isLoading={isCheckingOut}
                disabled={isCheckingOut || !canCheckout}
              >
                {isCheckingOut ? (
                  <>
                    <Spinner size="sm" />
                    Processing…
                  </>
                ) : canCheckout ? (
                  'Proceed to Checkout'
                ) : (
                  'No items ready for checkout'
                )}
              </Button>

              <p className="text-xs text-center text-fg-faint">
                Secure checkout via Stripe · Instant email delivery
              </p>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
