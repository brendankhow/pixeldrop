import { createPublicClient } from '@/lib/supabase/server';
import { AddToCartButton } from '@/components/store/AddToCartButton';
import { BuyNowButton } from '@/components/store/BuyNowButton';
import { ProductCard } from '@/components/store/ProductCard';
import { ProductImageGallery } from '@/components/store/ProductImageGallery';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, Download, Shield, Zap, Clock } from 'lucide-react';
import type { Metadata } from 'next';
import type { Product } from '@/types';

export const revalidate = 3600;

const categoryLabels: Record<Product['category'], string> = {
  iphone: 'Smartphone',
  desktop: 'Desktop',
  bundle: 'Bundle',
  other: 'Other',
};

export async function generateStaticParams() {
  try {
    const supabase = createPublicClient();
    const { data } = await supabase.from('products').select('id').eq('is_active', true);
    return (data ?? []).map((p) => ({ slug: p.id }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from('products')
      .select('name, description, preview_image_url')
      .eq('id', slug)
      .single();
    if (!data) return { title: 'Product Not Found' };
    const desc = data.description?.slice(0, 155) ?? undefined;
    return {
      title: `${data.name} — PixelDropp`,
      description: desc,
      robots: { index: true, follow: true },
      openGraph: {
        title: data.name,
        description: desc,
        images: data.preview_image_url ? [{ url: data.preview_image_url }] : [],
        type: 'website',
        siteName: 'PixelDropp',
      },
    };
  } catch {
    return { title: 'Product — PixelDropp' };
  }
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = createPublicClient();

  const { data: product, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', slug)
    .eq('is_active', true)
    .single();

  if (error || !product) notFound();

  const p = product as Product;

  // Fetch sales count from view (silently fails — never blocks the page)
  const { data: salesData } = await supabase
    .from('product_sales_counts')
    .select('sales_count')
    .eq('id', slug)
    .single();
  const salesCount = Number(salesData?.sales_count ?? 0);

  const { data: sameCategory } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .eq('category', p.category)
    .neq('id', p.id)
    .limit(4);

  let related: Product[] = (sameCategory ?? []) as Product[];

  if (related.length < 4) {
    const excludeIds = [p.id, ...related.map((r) => r.id)];
    const { data: others } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .not('id', 'in', `(${excludeIds.join(',')})`)
      .limit(4 - related.length);
    related = [...related, ...((others ?? []) as Product[])];
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">

      {/* Breadcrumb */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg transition-colors mb-8"
      >
        <ChevronLeft size={16} />
        All products
      </Link>

      {/* Product layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14">

        {/* Gallery */}
        <ProductImageGallery
          images={[
            ...(p.preview_image_url ? [p.preview_image_url] : []),
            ...(p.additional_images ?? []),
          ]}
          productName={p.name}
          category={p.category}
        />

        {/* Details */}
        <div className="flex flex-col gap-5">

          {/* Category badge */}
          <span className="inline-flex items-center self-start rounded-full bg-primary/15 border border-primary/30 px-3 py-1 text-xs font-medium text-[#A78BFA]">
            {categoryLabels[p.category]}
          </span>

          {/* Title + Price */}
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-fg leading-tight">{p.name}</h1>
            <div className="mt-3 flex items-baseline gap-3">
              {p.original_price && (
                <span className="text-2xl text-fg-faint line-through">
                  ${(p.original_price / 100).toFixed(2)}
                </span>
              )}
              <span className={`text-4xl font-bold ${p.original_price ? 'text-emerald-400' : 'text-fg'}`}>
                ${(p.price / 100).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Social proof */}
          {salesCount >= 3 && (
            <p className="text-sm text-fg-muted">
              🛒 {salesCount > 50 ? `${salesCount}+` : salesCount} customer{salesCount !== 1 ? 's' : ''} bought this
            </p>
          )}

          {/* Resolution spec */}
          {p.resolution && (
            <div className="flex items-center gap-2 text-sm text-fg-muted">
              <span className="text-base leading-none">📐</span>
              <span>Resolution: {p.resolution} px</span>
            </div>
          )}

          {/* Description */}
          {p.description && (
            <p className="text-fg-muted leading-relaxed">{p.description}</p>
          )}

          {/* Compatible devices */}
          {p.compatible_devices && p.compatible_devices.length > 0 && (
            <div>
              <p className="text-xs text-fg-faint mb-2">Compatible with:</p>
              <div className="flex flex-wrap gap-2">
                {p.compatible_devices.map((device) => (
                  <span
                    key={device}
                    className="rounded-full bg-[#1a1a1a] border border-[#2a2a2a] px-3 py-1 text-xs text-fg-muted"
                  >
                    {device}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {p.tags && p.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {p.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-edge border border-edge-2 px-3 py-1 text-xs text-fg-muted">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <BuyNowButton product={p} />
            <AddToCartButton product={p} />
          </div>

          {/* Trust bullets */}
          <div className="space-y-3 pt-1">
            <p className="text-xs text-fg-muted">✦ Instant delivery — files sent to your inbox within seconds</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: Download, text: 'High resolution files' },
                { icon: Shield, text: 'Secure checkout via Stripe' },
                { icon: Clock, text: 'Link valid for 48 hours' },
                { icon: Zap, text: 'No account required' },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2 text-xs text-fg-faint">
                  <Icon size={13} className="text-primary shrink-0" />
                  {text}
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Related products */}
      {related.length > 0 && (
        <div className="mt-20 pt-10 border-t border-edge">
          <h2 className="text-lg font-bold text-fg mb-6">You may also like</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {related.map((r) => (
              <ProductCard key={r.id} product={r} />
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
