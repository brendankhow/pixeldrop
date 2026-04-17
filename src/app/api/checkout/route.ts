import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';

interface CheckoutItem {
  stripe_price_id: string | null;
  quantity: number;
  product_id: string;
  name: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { items }: { items: CheckoutItem[] } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
    }

    // Gracefully skip items without a stripe_price_id
    const validItems = items.filter((i) => i.stripe_price_id);
    const skippedCount = items.length - validItems.length;

    if (validItems.length === 0) {
      return NextResponse.json(
        {
          error:
            'None of your cart items are ready for checkout yet. Pricing has not been configured — please contact the seller.',
        },
        { status: 400 }
      );
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: validItems.map((i) => ({
        price: i.stripe_price_id!,
        quantity: i.quantity,
      })),
      customer_creation: 'always',
      success_url: `${siteUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/`,
      metadata: {
        product_ids: JSON.stringify(validItems.map((i) => i.product_id)),
      },
    });

    return NextResponse.json({ url: session.url, skippedCount });
  } catch (err) {
    console.error('[checkout] error:', err);
    const message =
      err instanceof Error ? err.message : 'Checkout failed. Please try again.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
