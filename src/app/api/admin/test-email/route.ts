import { NextResponse } from 'next/server';
import sgMail from '@sendgrid/mail';

export async function GET() {
  const apiKey = process.env.SENDGRID_API_KEY;
  const from = process.env.FROM_EMAIL;

  if (!apiKey) return NextResponse.json({ error: 'SENDGRID_API_KEY not set' }, { status: 500 });
  if (!from) return NextResponse.json({ error: 'FROM_EMAIL not set' }, { status: 500 });

  sgMail.setApiKey(apiKey);

  try {
    await sgMail.send({
      from,
      to: from,
      subject: 'PixelDrop — SendGrid test',
      html: '<p>SendGrid is working!</p>',
    });
    return NextResponse.json({ success: true, from, to: from });
  } catch (err: any) {
    const body = err?.response?.body ?? null;
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message, sendgridResponse: body }, { status: 500 });
  }
}
