import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

const OK = NextResponse.json({ ok: true }, { status: 200 });

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      event_type,
      session_id,
      page_path,
      product_id,
      product_name,
      referrer,
      user_agent,
      device_type,
    } = body ?? {};

    if (!event_type || !session_id) return OK;
    if (!['page_visit', 'cart_add'].includes(event_type)) return OK;

    const supabase = createServiceClient();
    await supabase.from('activity_events').insert({
      event_type,
      session_id,
      page_path: page_path ?? null,
      product_id: product_id ?? null,
      product_name: product_name ?? null,
      referrer: referrer ?? null,
      user_agent: user_agent ?? null,
      device_type: device_type ?? null,
    });
  } catch {
    // Never expose errors — always return 200
  }
  return OK;
}
