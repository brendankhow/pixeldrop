import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';

// ── Auth guard ────────────────────────────────────────────────────────────────
async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// ── GET /api/admin/products ───────────────────────────────────────────────────
export async function GET() {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// ── POST /api/admin/products ──────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  // ── Parse fields ────────────────────────────────────────────────────────────
  const name = (formData.get('name') as string | null)?.trim();
  const description = (formData.get('description') as string | null)?.trim() ?? '';
  const category = formData.get('category') as string | null;
  const priceStr = formData.get('price') as string | null;
  const isActiveStr = formData.get('is_active') as string | null;
  const tagsStr = (formData.get('tags') as string | null) ?? '';

  // Files are uploaded directly from the browser to Supabase Storage.
  // The API only receives the resulting storage paths.
  const previewImagePath = formData.get('preview_image_path') as string | null;
  const newAdditionalPathsJson = formData.get('new_additional_paths') as string | null;
  const newDeliverablePathsJson = formData.get('new_deliverable_paths') as string | null;

  // ── Validate ────────────────────────────────────────────────────────────────
  if (!name) return NextResponse.json({ error: 'Product name is required' }, { status: 400 });
  if (!category) return NextResponse.json({ error: 'Category is required' }, { status: 400 });
  if (!priceStr) return NextResponse.json({ error: 'Price is required' }, { status: 400 });
  if (!previewImagePath) return NextResponse.json({ error: 'Preview image is required' }, { status: 400 });

  let newDeliverablePaths: string[] = [];
  if (newDeliverablePathsJson) {
    try { newDeliverablePaths = JSON.parse(newDeliverablePathsJson); } catch { /* ignore */ }
  }
  if (newDeliverablePaths.length === 0) {
    return NextResponse.json({ error: 'At least one deliverable file is required' }, { status: 400 });
  }

  const priceUsd = parseFloat(priceStr);
  if (isNaN(priceUsd) || priceUsd < 0.5) {
    return NextResponse.json({ error: 'Price must be at least $0.50' }, { status: 400 });
  }
  const priceCents = Math.round(priceUsd * 100);
  const isActive = isActiveStr !== 'false';
  const tags = tagsStr ? tagsStr.split(',').map((t) => t.trim()).filter(Boolean) : [];

  const supabase = createServiceClient();

  // ── Derive public URLs from storage paths ─────────────────────────────────
  const { data: previewUrlData } = supabase.storage
    .from('product-previews')
    .getPublicUrl(previewImagePath);
  const previewImageUrl = previewUrlData.publicUrl;

  let additionalImageUrls: string[] = [];
  if (newAdditionalPathsJson) {
    try {
      const paths: string[] = JSON.parse(newAdditionalPathsJson);
      additionalImageUrls = paths.map((p) => {
        const { data } = supabase.storage.from('product-previews').getPublicUrl(p);
        return data.publicUrl;
      });
    } catch { /* ignore malformed JSON */ }
  }

  // ── Create Stripe Product + Price ────────────────────────────────────────────
  let stripeProductId: string;
  let stripePriceId: string;

  try {
    const stripeProduct = await stripe.products.create({
      name,
      description: description || undefined,
    });
    const stripePrice = await stripe.prices.create({
      product: stripeProduct.id,
      unit_amount: priceCents,
      currency: 'usd',
    });
    stripeProductId = stripeProduct.id;
    stripePriceId = stripePrice.id;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Stripe error';
    return NextResponse.json({ error: `Stripe: ${msg}` }, { status: 500 });
  }

  // ── Insert into DB ──────────────────────────────────────────────────────────
  const { data: product, error: dbError } = await supabase
    .from('products')
    .insert({
      name,
      description: description || null,
      price: priceCents,
      category,
      preview_image_url: previewImageUrl,
      additional_images: additionalImageUrls,
      file_path: newDeliverablePaths[0],
      file_paths: newDeliverablePaths,
      is_active: isActive,
      tags,
      stripe_product_id: stripeProductId,
      stripe_price_id: stripePriceId,
    })
    .select()
    .single();

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  revalidatePath('/');
  revalidatePath('/products/[slug]', 'page');

  return NextResponse.json(product, { status: 201 });
}
