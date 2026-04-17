import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { createPublicClient } from '@/lib/supabase/server';
import { ProductGrid } from '@/components/store/ProductGrid';
import { Spinner } from '@/components/ui/Spinner';
import { Suspense } from 'react';
import type { Product } from '@/types';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'PixelDropp — Beautiful Digital Wallpapers',
  description: 'Hand-crafted wallpapers for iPhone, desktop and beyond. Instant delivery to your inbox.',
};

export default async function HomePage() {
  let products: Product[] = [];
  let error: string | null = null;

  try {
    const supabase = createPublicClient();
    const { data, error: fetchError } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    if (fetchError) throw fetchError;
    products = (data as Product[]) ?? [];
  } catch (e) {
    error = 'Unable to load products. Please refresh the page.';
    console.error('Products fetch error:', e);
  }

  const featured = products[0] ?? null;

  return (
    <>
      {/* Featured hero — latest drop */}
      {featured && (
        <section className="border-b border-edge">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">

              {/* Image */}
              <Link href={`/products/${featured.id}`} className="group relative w-full aspect-video rounded-2xl overflow-hidden bg-page-alt block">
                {featured.preview_image_url ? (
                  <Image
                    src={featured.preview_image_url}
                    alt={featured.name}
                    fill
                    priority
                    className="object-cover transition-transform duration-500 group-hover:scale-103"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-fg-faint text-sm">No preview</div>
                )}
              </Link>

              {/* Text */}
              <div className="flex flex-col gap-5">
                <div className="inline-flex items-center gap-2 self-start rounded-full bg-primary/10 border border-primary/30 px-3 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  <span className="text-xs font-medium text-[#A78BFA]">New drop</span>
                </div>

                <div>
                  <h1 className="text-3xl sm:text-4xl font-bold text-fg leading-tight">{featured.name}</h1>
                  {featured.description && (
                    <p className="mt-3 text-fg-muted leading-relaxed line-clamp-3">{featured.description}</p>
                  )}
                </div>

                <p className="text-3xl font-bold text-fg">${(featured.price / 100).toFixed(2)}</p>

                <div className="flex gap-3">
                  <Link
                    href={`/products/${featured.id}`}
                    className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-h transition-colors min-h-[48px]"
                  >
                    Shop Now
                  </Link>
                  <Link
                    href="#products"
                    className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-card border border-edge text-fg text-sm font-medium hover:border-edge-2 transition-colors min-h-[48px]"
                  >
                    All products
                  </Link>
                </div>

                <div className="flex items-center gap-6 text-xs text-fg-faint pt-1">
                  <span>✓ Instant delivery</span>
                  <span>✓ High resolution</span>
                  <span>✓ Secure checkout</span>
                </div>
              </div>

            </div>
          </div>
        </section>
      )}

      {/* Product grid */}
      {error ? (
        <div className="max-w-6xl mx-auto px-4 py-24 text-center">
          <p className="text-red-400">{error}</p>
        </div>
      ) : (
        <Suspense fallback={<div className="flex justify-center py-24"><Spinner size="lg" /></div>}>
          <ProductGrid products={products} />
        </Suspense>
      )}
    </>
  );
}
