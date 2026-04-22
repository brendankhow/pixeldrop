import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';
import type { Product } from '@/types';

type Params = { params: Promise<{ id: string }> };

// ── Auth guard ────────────────────────────────────────────────────────────────
async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// ── PATCH /api/admin/products/[id] ────────────────────────────────────────────
export async function PATCH(request: NextRequest, { params }: Params) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const supabase = createServiceClient();

  // Fetch current product (need existing stripe IDs + price)
  const { data: existing, error: fetchError } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }
  const current = existing as Product;

  const contentType = request.headers.get('content-type') ?? '';

  // ── JSON body (inline toggle from product list) ───────────────────────────
  if (contentType.includes('application/json')) {
    const body = await request.json();
    const updates: Partial<Product> = {};
    if (typeof body.is_active === 'boolean') updates.is_active = body.is_active;
    if (typeof body.name === 'string') updates.name = body.name;
    if (typeof body.description === 'string') updates.description = body.description;

    const { data, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    revalidatePath('/');
    revalidatePath('/products/[slug]', 'page');
    return NextResponse.json(data);
  }

  // ── FormData body (full edit form) ────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const name = (formData.get('name') as string | null)?.trim() ?? current.name;
  const description = (formData.get('description') as string | null)?.trim() ?? current.description ?? '';
  const category = (formData.get('category') as string | null) ?? current.category;
  const priceStr = formData.get('price') as string | null;
  const isActiveStr = formData.get('is_active') as string | null;
  const tagsStr = formData.get('tags') as string | null;
  const resolutionStr = formData.get('resolution') as string | null;
  const compatibleDevicesStr = formData.get('compatible_devices') as string | null;
  const badgeStr = formData.get('badge') as string | null;
  const originalPriceStr = formData.get('original_price') as string | null;

  const priceUsd = priceStr ? parseFloat(priceStr) : current.price / 100;
  if (isNaN(priceUsd) || priceUsd < 0.5) {
    return NextResponse.json({ error: 'Price must be at least $0.50' }, { status: 400 });
  }
  const priceCents = Math.round(priceUsd * 100);
  const isActive = isActiveStr !== null ? isActiveStr !== 'false' : current.is_active;
  const tags = tagsStr !== null
    ? tagsStr.split(',').map((t) => t.trim()).filter(Boolean)
    : current.tags;
  const resolution = resolutionStr !== null
    ? (resolutionStr.trim() || null)
    : current.resolution;
  const compatibleDevices = compatibleDevicesStr !== null
    ? (compatibleDevicesStr ? compatibleDevicesStr.split(',').map((d) => d.trim()).filter(Boolean) : null)
    : current.compatible_devices;
  const badge = badgeStr !== null ? (badgeStr.trim() || null) : current.badge;
  const originalPriceCents = originalPriceStr !== null
    ? (originalPriceStr.trim() ? Math.round(parseFloat(originalPriceStr) * 100) : null)
    : current.original_price;

  // Files are uploaded directly from the browser to Supabase Storage.
  // The API only receives storage paths (no file blobs cross Vercel's body limit).
  const newPreviewImagePath = formData.get('preview_image_path') as string | null;
  const keepPreviewUrl = formData.get('keep_preview_url') as string | null;
  const keepAdditionalJson = formData.get('keep_additional_urls') as string | null;
  const newAdditionalPathsJson = formData.get('new_additional_paths') as string | null;
  const keepFilePathsJson = formData.get('keep_file_paths') as string | null;
  const newDeliverablePathsJson = formData.get('new_deliverable_paths') as string | null;

  let previewImageUrl = current.preview_image_url;

  if (newPreviewImagePath) {
    const { data } = supabase.storage.from('product-previews').getPublicUrl(newPreviewImagePath);
    previewImageUrl = data.publicUrl;
  } else if (keepPreviewUrl) {
    previewImageUrl = keepPreviewUrl;
  }

  // Build the merged file_paths array
  let keepFilePaths: string[] = current.file_paths?.length
    ? current.file_paths
    : current.file_path ? [current.file_path] : [];
  if (keepFilePathsJson) {
    try { keepFilePaths = JSON.parse(keepFilePathsJson); } catch { /* ignore */ }
  }
  let newDeliverablePaths: string[] = [];
  if (newDeliverablePathsJson) {
    try { newDeliverablePaths = JSON.parse(newDeliverablePathsJson); } catch { /* ignore */ }
  }
  const mergedFilePaths = [...keepFilePaths, ...newDeliverablePaths];
  const filePath = mergedFilePaths[0] ?? current.file_path;

  let keepAdditional: string[] = [];
  if (keepAdditionalJson) {
    try { keepAdditional = JSON.parse(keepAdditionalJson); } catch { /* ignore */ }
  }

  let newAdditionalUrls: string[] = [];
  if (newAdditionalPathsJson) {
    try {
      const paths: string[] = JSON.parse(newAdditionalPathsJson);
      newAdditionalUrls = paths.map((p) => {
        const { data } = supabase.storage.from('product-previews').getPublicUrl(p);
        return data.publicUrl;
      });
    } catch { /* ignore */ }
  }

  const additionalImages: string[] = [...keepAdditional, ...newAdditionalUrls];

  // ── If price changed: create new Stripe Price, archive old one ────────────
  let stripePriceId = current.stripe_price_id;

  if (priceCents !== current.price && current.stripe_product_id) {
    try {
      const newPrice = await stripe.prices.create({
        product: current.stripe_product_id,
        unit_amount: priceCents,
        currency: 'usd',
      });
      // Archive the old price
      if (current.stripe_price_id) {
        await stripe.prices.update(current.stripe_price_id, { active: false });
      }
      stripePriceId = newPrice.id;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Stripe price update failed';
      return NextResponse.json({ error: `Stripe: ${msg}` }, { status: 500 });
    }
  }

  // ── Update DB ─────────────────────────────────────────────────────────────
  const { data, error: updateError } = await supabase
    .from('products')
    .update({
      name,
      description: description || null,
      price: priceCents,
      category,
      preview_image_url: previewImageUrl,
      additional_images: additionalImages.length > 0 ? additionalImages : null,
      file_path: filePath,
      file_paths: mergedFilePaths.length > 0 ? mergedFilePaths : null,
      is_active: isActive,
      tags,
      stripe_price_id: stripePriceId,
      resolution,
      compatible_devices: compatibleDevices,
      badge,
      original_price: originalPriceCents,
    })
    .eq('id', id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  revalidatePath('/');
  revalidatePath('/products/[slug]', 'page');

  return NextResponse.json(data);
}

// ── DELETE /api/admin/products/[id] — soft delete ─────────────────────────────
export async function DELETE(_request: NextRequest, { params }: Params) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const supabase = createServiceClient();

  const { error } = await supabase
    .from('products')
    .update({ is_active: false })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  revalidatePath('/');
  revalidatePath('/products/[slug]', 'page');
  return NextResponse.json({ success: true });
}
