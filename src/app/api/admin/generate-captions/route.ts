import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import type { Product } from '@/types';

const TONE_DESCRIPTIONS: Record<string, string> = {
  aesthetic: 'Dreamy, evocative, visual-first — no hype words',
  hype:      'Energetic, punchy, drop culture language',
  minimal:   'One or two lines max, clean and understated',
  story:     'Short narrative — describe the mood or scene depicted',
};

export async function POST(request: NextRequest) {
  // ── Auth guard ────────────────────────────────────────────────────────────
  const supabaseAuth = await createClient();
  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // ── Parse body ────────────────────────────────────────────────────────────
  let product_id: string;
  let platform: 'instagram' | 'twitter';
  let tone: 'aesthetic' | 'hype' | 'minimal' | 'story';

  try {
    const body = await request.json();
    product_id = body?.product_id;
    platform = body?.platform;
    tone = body?.tone;
    if (!product_id || !platform || !tone) throw new Error('missing fields');
  } catch {
    return NextResponse.json({ error: 'product_id, platform, and tone are required' }, { status: 400 });
  }

  // ── Fetch product ─────────────────────────────────────────────────────────
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', product_id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }
  const product = data as Product;

  // ── Build prompt ──────────────────────────────────────────────────────────
  const platformGuide = platform === 'instagram'
    ? 'Instagram (up to 2200 chars, use line breaks, 10-20 hashtags)'
    : 'Twitter/X (under 280 chars including URL, 2-3 hashtags max)';

  const userPrompt = `Write 3 caption variants for a ${platform} post promoting this wallpaper product.

Product name: ${product.name}
Description: ${product.description ?? 'N/A'}
Category: ${product.category}
Tags: ${product.tags?.join(', ') ?? 'N/A'}
Tone: ${tone} — ${TONE_DESCRIPTIONS[tone]}

Platform: ${platformGuide}

Return ONLY valid JSON, no markdown, no backticks:
{
  "variants": [
    { "caption": "...", "hashtags": "..." },
    { "caption": "...", "hashtags": "..." },
    { "caption": "...", "hashtags": "..." }
  ]
}`;

  // ── Call Claude ───────────────────────────────────────────────────────────
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: `You are a social media copywriter for PixelDrop, a premium AI wallpaper store. You write platform-native captions for product drops. Be concise and authentic. Never use generic phrases like "check it out" or "link in bio". Always include relevant hashtags at the end.`,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const raw = message.content[0].type === 'text' ? message.content[0].text : '';

    try {
      const parsed = JSON.parse(raw);
      return NextResponse.json(parsed);
    } catch {
      // Claude occasionally wraps JSON in markdown fences — strip and retry
      const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      try {
        const parsed = JSON.parse(stripped);
        return NextResponse.json(parsed);
      } catch {
        return NextResponse.json({ error: 'Failed to parse Claude response', raw }, { status: 500 });
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Claude API error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
