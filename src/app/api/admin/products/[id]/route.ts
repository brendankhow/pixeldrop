import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
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

// ── Upload helper ─────────────────────────────────────────────────────────────
async function uploadToStorage(
  supabase: ReturnType<typeof createServiceClient>,
  bucket: string,
  file: File,
  suffix: string
): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'bin';
  const path = `${randomUUID()}-${suffix}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, buffer, { contentType: file.type, upsert: false });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return path;
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

  const priceUsd = priceStr ? parseFloat(priceStr) : current.price / 100;
  if (isNaN(priceUsd) || priceUsd < 0.5) {
    return NextResponse.json({ error: 'Price must be at least $0.50' }, { status: 400 });
  }
  const priceCents = Math.round(priceUsd * 100);
  const isActive = isActiveStr !== null ? isActiveStr !== 'false' : current.is_active;
  const tags = tagsStr !== null
    ? tagsStr.split(',').map((t) => t.trim()).filter(Boolean)
    : current.tags;

  const newPreviewFile = formData.get('preview_image');
  const newDeliverableFile = formData.get('deliverable_file');
  const keepPreviewUrl = formData.get('keep_preview_url') as string | null;
  const keepAdditionalJson = formData.get('keep_additional_urls') as string | null;
  const newAdditionalFiles = formData.getAll('additional_images');

  let previewImageUrl = current.preview_image_url;
  let filePath = current.file_path;

  function isUploadedFile(v: FormDataEntryValue | null): v is File {
    return !!v && typeof (v as Blob).size === 'number' && (v as Blob).size > 0;
  }

  let keepAdditional: string[] = [];
  if (keepAdditionalJson) {
    try { keepAdditional = JSON.parse(keepAdditionalJson); } catch { /* ignore */ }
  }

  try {
    if (isUploadedFile(newPreviewFile)) {
      const newPath = await uploadToStorage(supabase, 'product-previews', newPreviewFile, 'preview');
      const { data } = supabase.storage.from('product-previews').getPublicUrl(newPath);
      previewImageUrl = data.publicUrl;
    } else if (keepPreviewUrl) {
      previewImageUrl = keepPreviewUrl;
    }
    if (isUploadedFile(newDeliverableFile)) {
      filePath = await uploadToStorage(supabase, 'product-files', newDeliverableFile, 'file');
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'File upload failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // Upload new additional images and merge with kept existing ones
  let additionalImages: string[] = [...keepAdditional];
  try {
    for (const f of newAdditionalFiles) {
      if (isUploadedFile(f)) {
        const path = await uploadToStorage(supabase, 'product-previews', f, 'additional');
        const { data } = supabase.storage.from('product-previews').getPublicUrl(path);
        additionalImages.push(data.publicUrl);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Additional image upload failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }

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
      is_active: isActive,
      tags,
      stripe_price_id: stripePriceId,
    })
    .eq('id', id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

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
  return NextResponse.json({ success: true });
}
