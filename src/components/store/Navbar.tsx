'use client';

import Link from 'next/link';
import { ShoppingCart, Sun, Moon } from 'lucide-react';
import { useCartStore } from '@/lib/cart-store';
import { CartDrawer } from './CartDrawer';
import { useState, useEffect } from 'react';

function useTheme() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    setTheme(document.documentElement.classList.contains('light') ? 'light' : 'dark');
  }, []);

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.classList.toggle('light', next === 'light');
    try { localStorage.setItem('theme', next); } catch {}
  }

  return { theme, toggle };
}

export function Navbar() {
  const { getTotalItems, openCart } = useCartStore();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const itemCount = mounted ? getTotalItems() : 0;
  const { theme, toggle } = useTheme();

  return (
    <>
      <header className="sticky top-0 z-30 bg-page/90 backdrop-blur-md border-b border-edge">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link
              href="/"
              className="flex items-center gap-2 text-xl font-bold text-fg hover:text-fg transition-colors"
            >
              <span className="text-primary">✦</span>
              PixelDropp
            </Link>

            <div className="flex items-center gap-2">
              {/* Theme toggle */}
              <button
                onClick={toggle}
                className="flex items-center justify-center w-11 h-11 rounded-xl bg-card border border-edge text-fg-muted hover:text-fg hover:border-edge-2 transition-colors"
                aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              >
                {mounted && theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>

              {/* Cart */}
              <button
                onClick={openCart}
                className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-card border border-edge text-fg-muted hover:text-fg hover:border-edge-2 transition-colors"
                aria-label={`Open cart${itemCount > 0 ? `, ${itemCount} items` : ''}`}
              >
                <ShoppingCart size={20} />
                {itemCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                    {itemCount > 99 ? '99+' : itemCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      <CartDrawer />
    </>
  );
}
