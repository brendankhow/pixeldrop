import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { generateSignedUrl } from '@/lib/supabase/storage';
import { sendDeliveryEmail } from '@/lib/email';
import type { Order, Product } from '@/types';

export async function POST(request: NextRequest) {
  // ── Auth check — admin only ─────────────────────────────────────────────────
  const supabaseAuth = await createClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Parse body ──────────────────────────────────────────────────────────────
  let orderId: string;
  try {
    const body = await request.json();
    orderId = body.orderId;
    if (!orderId) throw new Error('orderId is required');
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // ── Fetch order ─────────────────────────────────────────────────────────────
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  const typedOrder = order as Order;

  // ── Fetch products for this order ───────────────────────────────────────────
  const productIds = typedOrder.products.map((p) => p.id);
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, name, price, file_path, file_paths')
    .in('id', productIds);

  if (productsError) {
    return NextResponse.json(
      { error: `Failed to fetch products: ${productsError.message}` },
      { status: 500 }
    );
  }

  const fetchedProducts = (products ?? []) as Pick<Product, 'id' | 'name' | 'price' | 'file_path' | 'file_paths'>[];

  // ── Generate fresh signed URLs (one per deliverable file per product) ────────
  const downloadLinks = await Promise.all(
    fetchedProducts.flatMap((product) => {
      const paths = product.file_paths?.length ? product.file_paths : [product.file_path];
      return paths.map(async (filePath) => {
        const label = paths.length > 1
          ? `${product.name} — ${filePath.split('/').pop()}`
          : product.name;
        try {
          const url = await generateSignedUrl(filePath);
          return { productName: label, url };
        } catch (err) {
          console.error(`[resend-email] Could not generate signed URL for "${filePath}":`, err);
          return { productName: label, url: '#' };
        }
      });
    })
  );

  // ── Resend delivery email ───────────────────────────────────────────────────
  try {
    await sendDeliveryEmail({
      to: typedOrder.customer_email,
      products: typedOrder.products,
      downloadLinks,
      orderTotal: typedOrder.amount_total,
    });
  } catch (emailErr) {
    const message = emailErr instanceof Error ? emailErr.message : 'Email send failed';
    console.error('[resend-email] Failed to send email:', emailErr);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // ── Update email_sent_at ────────────────────────────────────────────────────
  await supabase
    .from('orders')
    .update({ email_sent_at: new Date().toISOString() })
    .eq('id', orderId);

  return NextResponse.json({ success: true });
}
