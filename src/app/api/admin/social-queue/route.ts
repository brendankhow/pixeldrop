import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

async function authGuard() {
  const supabaseAuth = await createClient();
  const { data: { user } } = await supabaseAuth.auth.getUser();
  return user;
}

export async function GET() {
  const user = await authGuard();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('social_queue')
    .select('*, product:products(name, preview_image_url)')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const user = await authGuard();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { product_id: string; platform: string; format_slug: string; caption?: string };
  try {
    body = await request.json();
    if (!body.product_id || !body.platform || !body.format_slug) throw new Error('missing fields');
  } catch {
    return NextResponse.json({ error: 'product_id, platform, and format_slug are required' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('social_queue')
    .insert({
      product_id: body.product_id,
      platform: body.platform,
      format_slug: body.format_slug,
      caption: body.caption ?? null,
      status: 'draft',
    })
    .select('*, product:products(name, preview_image_url)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
