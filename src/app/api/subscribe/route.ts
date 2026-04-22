import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { generateSignedUrl } from '@/lib/supabase/storage';
import { sendSubscriberEmail } from '@/lib/email';

// Always return 200 — never expose internal errors to the client
const ok = () => NextResponse.json({ ok: true });

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email: string = (body?.email ?? '').trim().toLowerCase();

    // 1. Basic email validation
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return ok(); // silent — client shows success to avoid enumeration
    }

    const supabase = createServiceClient();

    // 2. Check for duplicate — upsert would work but we want to know if it's new
    const { data: existing } = await supabase
      .from('email_subscribers')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existing) {
      return ok(); // already subscribed — silent success
    }

    // 3. Find first active free product (price = 0)
    const { data: freeProduct } = await supabase
      .from('products')
      .select('id, name, file_path, file_paths')
      .eq('price', 0)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    // 4. Insert subscriber row
    const { data: subscriber } = await supabase
      .from('email_subscribers')
      .insert({
        email,
        source: 'popup',
        free_product_id: freeProduct?.id ?? null,
      })
      .select('id')
      .single();

    // 5. If no free product, we're done — subscriber added without delivery
    if (!freeProduct || !subscriber) return ok();

    // 6. Generate signed URL for the free product file
    const filePaths: string[] = freeProduct.file_paths?.length
      ? freeProduct.file_paths
      : freeProduct.file_path
      ? [freeProduct.file_path]
      : [];

    if (filePaths.length === 0) return ok();

    let downloadUrl: string;
    try {
      downloadUrl = await generateSignedUrl(filePaths[0]);
    } catch {
      // File not found in storage — don't crash, subscriber is already saved
      return ok();
    }

    // 7. Send delivery email
    try {
      await sendSubscriberEmail({
        to: email,
        downloadUrl,
        productName: freeProduct.name,
      });

      // Mark as delivered
      await supabase
        .from('email_subscribers')
        .update({ delivered_at: new Date().toISOString() })
        .eq('id', subscriber.id);
    } catch {
      // Email failed — subscriber is still saved, admin can follow up
    }

    return ok();
  } catch {
    // Never surface internal errors
    return ok();
  }
}
