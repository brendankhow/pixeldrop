import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { createClient, createServiceClient } from '@/lib/supabase/server';

const ALLOWED_BUCKETS = ['product-previews', 'product-files'];

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { bucket, filename } = await request.json();

  if (!ALLOWED_BUCKETS.includes(bucket as string)) {
    return NextResponse.json({ error: 'Invalid bucket' }, { status: 400 });
  }
  if (!filename) {
    return NextResponse.json({ error: 'filename required' }, { status: 400 });
  }

  const ext = (filename as string).split('.').pop() ?? 'bin';
  const path = `${randomUUID()}.${ext}`;

  const service = createServiceClient();
  const { data, error } = await service.storage.from(bucket as string).createSignedUploadUrl(path);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ signedUrl: data.signedUrl, path, token: data.token });
}
