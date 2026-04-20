/**
 * Stripe Webhook Handler — PixelDropp fulfilment engine
 *
 * Full flow for checkout.session.completed:
 *   1. Verify Stripe signature (reject invalid requests with 400)
 *   2. Idempotency check — skip if order already exists for this session
 *   3. Extract customer email, amount, currency, product IDs from session
 *   4. Fetch product details from Supabase (name, price, file_path)
 *   5. Insert order into DB with status = 'paid'
 *   6. Generate 48-hour signed download URLs from Supabase Storage (private bucket)
 *   7. Send delivery email via Resend with download buttons
 *   8. Update order status = 'delivered', set email_sent_at = now()
 *   9. If email fails: log error, leave status = 'paid' (admin can resend from /admin/orders)
 *  10. Always return 200 after signature check passes — prevents Stripe retries on internal errors
 *
 * Local testing:
 *   stripe login
 *   stripe listen --forward-to localhost:3000/api/webhooks/stripe
 *   # Copy the webhook signing secret it prints → set as STRIPE_WEBHOOK_SECRET in .env.local
 *   stripe trigger checkout.session.completed
 *
 * NOTE: In App Router, raw body is accessed via request.text() — no Pages Router
 * bodyParser config needed. Stripe signature verification requires the raw body string.
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { createServiceClient } from '@/lib/supabase/server';
import { generateSignedUrl } from '@/lib/supabase/storage';
import { sendDeliveryEmail } from '@/lib/email';
import type { Product } from '@/types';

// Required for Stripe signature verification in App Router
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // ── 1. Parse raw body & verify signature ───────────────────────────────────
  const body = await request.text();
  const sig = request.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    console.error('[webhook] Missing stripe-signature or STRIPE_WEBHOOK_SECRET');
    return NextResponse.json({ error: 'Webhook configuration error' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Signature verification failed';
    console.error('[webhook] Signature verification failed:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // ── 2. Dispatch event ───────────────────────────────────────────────────────
  // Always return 200 below this point — Stripe retries on non-2xx responses
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      case 'charge.refunded':
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;

      default:
        // Unhandled event types — ignore silently
        break;
    }
  } catch (err) {
    // Internal processing error — log but still return 200 to prevent Stripe retries
    console.error(`[webhook] Unhandled error processing ${event.type}:`, err);
  }

  return NextResponse.json({ received: true });
}

// ── Event handlers ────────────────────────────────────────────────────────────

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const supabase = createServiceClient();
  const sessionId = session.id;

  // ── Idempotency check ───────────────────────────────────────────────────────
  const { data: existingOrder } = await supabase
    .from('orders')
    .select('id')
    .eq('stripe_session_id', sessionId)
    .single();

  if (existingOrder) {
    console.log(`[webhook] Order already exists for session ${sessionId} — skipping`);
    return;
  }

  // ── Extract session data ────────────────────────────────────────────────────
  const customerEmail = session.customer_details?.email;
  if (!customerEmail) {
    throw new Error(`[webhook] No customer email in session ${sessionId}`);
  }

  const amountTotal = session.amount_total ?? 0;
  const currency = session.currency ?? 'usd';
  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  const productIds: string[] = session.metadata?.product_ids
    ? (JSON.parse(session.metadata.product_ids) as string[])
    : [];

  // ── Fetch product details from Supabase ─────────────────────────────────────
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, name, price, file_path, file_paths')
    .in('id', productIds);

  if (productsError) throw productsError;
  const fetchedProducts = (products ?? []) as Pick<Product, 'id' | 'name' | 'price' | 'file_path' | 'file_paths'>[];

  const orderProducts = fetchedProducts.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
  }));

  // ── Insert order with status = 'paid' ───────────────────────────────────────
  const { data: newOrder, error: insertError } = await supabase
    .from('orders')
    .insert({
      stripe_session_id: sessionId,
      stripe_payment_intent_id: paymentIntentId,
      customer_email: customerEmail,
      amount_total: amountTotal,
      currency,
      status: 'paid',
      products: orderProducts,
    })
    .select('id')
    .single();

  if (insertError || !newOrder) {
    throw new Error(`[webhook] Failed to insert order: ${insertError?.message}`);
  }

  const orderId = newOrder.id;
  console.log(`[webhook] Order ${orderId} created for session ${sessionId}`);

  // ── Generate signed download URLs (one per deliverable file per product) ────
  const downloadLinks = (
    await Promise.all(
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
            console.error(`[webhook] Could not generate signed URL for "${filePath}":`, err);
            return { productName: label, url: '#' };
          }
        });
      })
    )
  );

  // ── Send delivery email — failure keeps status = 'paid', admin can resend ──
  try {
    await sendDeliveryEmail({
      to: customerEmail,
      products: orderProducts,
      downloadLinks,
      orderTotal: amountTotal,
    });

    // ── Mark as delivered ─────────────────────────────────────────────────────
    await supabase
      .from('orders')
      .update({ status: 'delivered', email_sent_at: new Date().toISOString() })
      .eq('id', orderId);

    console.log(`[webhook] Delivery email sent for order ${orderId} → ${customerEmail}`);
  } catch (emailErr) {
    // Email failed — order stays 'paid' so admin can resend from /admin/orders
    const errMsg = emailErr instanceof Error ? emailErr.message : String(emailErr);
    const errDetail = emailErr instanceof Error && (emailErr as any).response?.body
      ? JSON.stringify((emailErr as any).response.body)
      : '';
    console.error(`[webhook] Email delivery failed for order ${orderId}: ${errMsg} ${errDetail}`);
  }
}

async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from('orders')
    .update({ status: 'failed' })
    .eq('stripe_payment_intent_id', paymentIntent.id);

  if (error) {
    console.error('[webhook] Failed to update order status to failed:', error.message);
  } else {
    console.log(`[webhook] Order marked failed for payment_intent ${paymentIntent.id}`);
  }
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  const supabase = createServiceClient();

  const paymentIntentId =
    typeof charge.payment_intent === 'string'
      ? charge.payment_intent
      : charge.payment_intent?.id ?? null;

  if (!paymentIntentId) {
    console.warn('[webhook] charge.refunded has no payment_intent id — skipping');
    return;
  }

  const { error } = await supabase
    .from('orders')
    .update({ status: 'refunded' })
    .eq('stripe_payment_intent_id', paymentIntentId);

  if (error) {
    console.error('[webhook] Failed to update order status to refunded:', error.message);
  } else {
    console.log(`[webhook] Order marked refunded for payment_intent ${paymentIntentId}`);
  }
}
