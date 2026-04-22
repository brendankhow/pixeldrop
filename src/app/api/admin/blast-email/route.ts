import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { sendBlastEmail } from '@/lib/email';
import type { Product } from '@/types';

export async function POST(request: NextRequest) {
  // ── Auth guard ────────────────────────────────────────────────────────────
  const supabaseAuth = await createClient();
  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // ── Parse body ────────────────────────────────────────────────────────────
  let product_id: string;
  try {
    const body = await request.json();
    product_id = body?.product_id;
    if (!product_id) throw new Error('missing product_id');
  } catch {
    return NextResponse.json({ error: 'product_id is required' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // ── Fetch product ─────────────────────────────────────────────────────────
  const { data: productData, error: productError } = await supabase
    .from('products')
    .select('*')
    .eq('id', product_id)
    .single();

  if (productError || !productData) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }
  const product = productData as Product;

  if (!product.is_active) {
    return NextResponse.json({ error: 'Cannot blast an inactive product' }, { status: 400 });
  }

  // ── Fetch all subscriber emails ───────────────────────────────────────────
  const { data: subscribers } = await supabase
    .from('email_subscribers')
    .select('email');

  const emails = (subscribers ?? []).map((s: { email: string }) => s.email).filter(Boolean);

  if (emails.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://pixeldropp.vercel.app';

  // ── Send blast (Promise.allSettled — one bad address won't break the batch) ─
  const results = await Promise.allSettled(
    emails.map((email) =>
      sendBlastEmail({
        to: email,
        productName: product.name,
        productDescription: product.description ?? '',
        productPrice: product.price,
        productPreviewUrl: product.preview_image_url,
        productSlug: product.id,
        siteUrl,
      })
    )
  );

  const sent = results.filter((r) => r.status === 'fulfilled').length;

  // ── Update last_blast_at ──────────────────────────────────────────────────
  await supabase
    .from('products')
    .update({ last_blast_at: new Date().toISOString() })
    .eq('id', product_id);

  return NextResponse.json({ ok: true, sent });
}
