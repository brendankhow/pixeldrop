import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  // Auth check — admin only
  const supabaseAuth = await createClient();
  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const eventType = searchParams.get('event_type');
  const since = searchParams.get('since');
  const limitParam = parseInt(searchParams.get('limit') ?? '50', 10);
  const limit = Math.min(isNaN(limitParam) ? 50 : limitParam, 200);

  const supabase = createServiceClient();
  let query = supabase
    .from('activity_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (eventType === 'page_visit' || eventType === 'cart_add') {
    query = query.eq('event_type', eventType);
  }
  if (since) {
    query = query.gte('created_at', since);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
