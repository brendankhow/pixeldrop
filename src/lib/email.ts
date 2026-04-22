import sgMail from '@sendgrid/mail';

interface SendDeliveryEmailParams {
  to: string;
  products: Array<{ id: string; name: string; price: number }>;
  downloadLinks: Array<{ productName: string; url: string }>;
  orderTotal: number; // in cents
}

function buildHtml(
  products: SendDeliveryEmailParams['products'],
  downloadLinks: SendDeliveryEmailParams['downloadLinks'],
  orderTotal: number,
): string {
  const orderRows = products
    .map(
      (p) => `
      <tr>
        <td style="padding:6px 0;color:#EDEDED;font-size:14px;">${p.name}</td>
        <td style="padding:6px 0;color:#9CA3AF;font-size:14px;text-align:right;">$${(p.price / 100).toFixed(2)}</td>
      </tr>`,
    )
    .join('');

  const downloadButtons = downloadLinks
    .map(
      (d) => `
      <a href="${d.url}" style="display:block;background:#5B21B6;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:10px;font-size:14px;font-weight:600;text-align:center;margin-bottom:10px;">
        &#8595; Download — ${d.productName}
      </a>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="background:#0A0A0A;font-family:system-ui,-apple-system,Arial,sans-serif;margin:0;padding:0;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
    <div style="text-align:center;padding-bottom:24px;">
      <p style="font-size:22px;font-weight:700;color:#EDEDED;margin:0;">&#10022; PixelDropp</p>
      <p style="font-size:13px;color:#9CA3AF;margin:6px 0 0;">Beautiful wallpapers for every screen</p>
    </div>

    <div style="background:#111111;border-radius:16px;padding:28px;margin-bottom:20px;border:1px solid #1F1F1F;">
      <p style="font-size:24px;font-weight:700;color:#EDEDED;margin:0 0 10px;">Your wallpapers are ready!</p>
      <p style="font-size:15px;color:#9CA3AF;margin:0 0 24px;">Thank you for your purchase. Your high-resolution files are waiting below.</p>
      <hr style="border-color:#1F1F1F;margin:20px 0;">
      <p style="font-size:11px;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 14px;">Order Summary</p>
      <table width="100%" cellpadding="0" cellspacing="0">${orderRows}</table>
      <hr style="border-color:#1F1F1F;margin:20px 0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="color:#EDEDED;font-size:14px;font-weight:600;">Total paid</td>
          <td style="color:#EDEDED;font-size:20px;font-weight:700;text-align:right;">$${(orderTotal / 100).toFixed(2)}</td>
        </tr>
      </table>
    </div>

    <div style="margin-bottom:20px;">
      <p style="font-size:16px;font-weight:600;color:#EDEDED;margin:0 0 16px;">Your Downloads</p>
      ${downloadButtons}
    </div>

    <div style="background:#111111;border-radius:10px;padding:14px 18px;margin-bottom:24px;border:1px solid #1F1F1F;">
      <p style="font-size:13px;color:#9CA3AF;margin:0;text-align:center;">&#8987; Links expire in 48 hours. Reply to this email if you need them resent.</p>
    </div>

    <hr style="border-color:#1F1F1F;margin:20px 0;">
    <p style="font-size:12px;color:#6B7280;text-align:center;margin:16px 0 6px;">Thank you for your purchase &middot; PixelDropp</p>
    <p style="font-size:11px;color:#374151;text-align:center;margin:0;">You received this email because you made a purchase at PixelDropp.</p>
  </div>
</body>
</html>`;
}

interface SendSubscriberEmailParams {
  to: string;
  downloadUrl: string;
  productName: string;
}

function buildSubscriberHtml(downloadUrl: string, productName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="background:#F3F4F6;font-family:system-ui,-apple-system,Arial,sans-serif;margin:0;padding:0;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
    <div style="text-align:center;padding-bottom:24px;">
      <p style="font-size:22px;font-weight:700;color:#111827;margin:0;">&#10022; PixelDropp</p>
      <p style="font-size:13px;color:#6B7280;margin:6px 0 0;">Beautiful wallpapers for every screen</p>
    </div>

    <div style="background:#FFFFFF;border-radius:16px;padding:28px;margin-bottom:20px;border:1px solid #E5E7EB;">
      <p style="font-size:24px;font-weight:700;color:#111827;margin:0 0 10px;">Your free wallpaper is here ✨</p>
      <p style="font-size:15px;color:#6B7280;margin:0 0 24px;line-height:1.6;">
        Thanks for joining PixelDropp. Here's your complimentary wallpaper — <strong style="color:#111827;">${productName}</strong>. Enjoy!
      </p>
      <a href="${downloadUrl}" style="display:block;background:#5B21B6;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:10px;font-size:14px;font-weight:600;text-align:center;margin-bottom:10px;">
        &#8595; Download your free wallpaper
      </a>
    </div>

    <div style="background:#F9FAFB;border-radius:10px;padding:14px 18px;margin-bottom:24px;border:1px solid #E5E7EB;">
      <p style="font-size:13px;color:#6B7280;margin:0;text-align:center;">&#8987; Download link expires in 48 hours.</p>
    </div>

    <hr style="border-color:#E5E7EB;margin:20px 0;">
    <p style="font-size:12px;color:#9CA3AF;text-align:center;margin:16px 0 6px;">&#10022; PixelDropp &middot; The premium digital product marketplace.</p>
    <p style="font-size:11px;color:#D1D5DB;text-align:center;margin:0;">You received this because you opted in at PixelDropp.</p>
  </div>
</body>
</html>`;
}

interface SendBlastEmailParams {
  to: string;
  productName: string;
  productDescription: string;
  productPrice: number; // cents
  productPreviewUrl: string | null;
  productSlug: string;
  siteUrl: string;
}

function buildBlastHtml(p: SendBlastEmailParams): string {
  const priceStr = `$${(p.productPrice / 100).toFixed(2)}`;
  const shortDesc = p.productDescription?.slice(0, 150) ?? '';
  const pdpUrl = `${p.siteUrl}/products/${p.productSlug}`;
  const previewImg = p.productPreviewUrl
    ? `<img src="${p.productPreviewUrl}" alt="${p.productName}" style="width:100%;border-radius:12px;margin-bottom:20px;display:block;" />`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="background:#F3F4F6;font-family:system-ui,-apple-system,Arial,sans-serif;margin:0;padding:0;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
    <div style="text-align:center;padding-bottom:24px;">
      <p style="font-size:22px;font-weight:700;color:#111827;margin:0;">&#10022; PixelDropp</p>
      <p style="font-size:13px;color:#6B7280;margin:6px 0 0;">Beautiful wallpapers for every screen</p>
    </div>

    <div style="background:#FFFFFF;border-radius:16px;padding:28px;margin-bottom:20px;border:1px solid #E5E7EB;">
      <p style="font-size:12px;font-weight:600;color:#5B21B6;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 12px;">New drop</p>
      <p style="font-size:22px;font-weight:700;color:#111827;margin:0 0 8px;letter-spacing:-0.02em;">${p.productName}</p>
      ${shortDesc ? `<p style="font-size:14px;color:#6B7280;margin:0 0 20px;line-height:1.6;">${shortDesc}</p>` : ''}
      ${previewImg}
      <p style="font-size:28px;font-weight:700;color:#111827;margin:0 0 20px;">${priceStr}</p>
      <a href="${pdpUrl}" style="display:block;background:#5B21B6;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:10px;font-size:14px;font-weight:600;text-align:center;">
        Shop Now &rarr;
      </a>
    </div>

    <hr style="border-color:#E5E7EB;margin:20px 0;">
    <p style="font-size:12px;color:#9CA3AF;text-align:center;margin:0 0 6px;">You're receiving this because you opted in at PixelDropp.</p>
    <p style="font-size:11px;color:#D1D5DB;text-align:center;margin:0;">
      <a href="mailto:unsubscribe@pixeldropp.com?subject=Unsubscribe" style="color:#D1D5DB;">Unsubscribe</a>
    </p>
  </div>
</body>
</html>`;
}

export async function sendBlastEmail(params: SendBlastEmailParams): Promise<void> {
  const apiKey = process.env.SENDGRID_API_KEY;
  const from = process.env.FROM_EMAIL;
  if (!apiKey) throw new Error('SENDGRID_API_KEY is not set');
  if (!from) throw new Error('FROM_EMAIL is not set');

  sgMail.setApiKey(apiKey);

  await sgMail.send({
    from,
    to: params.to,
    subject: `New drop: ${params.productName} 🎨`,
    html: buildBlastHtml(params),
  });
}

export async function sendSubscriberEmail({ to, downloadUrl, productName }: SendSubscriberEmailParams) {
  const apiKey = process.env.SENDGRID_API_KEY;
  const from = process.env.FROM_EMAIL;
  if (!apiKey) throw new Error('SENDGRID_API_KEY is not set');
  if (!from) throw new Error('FROM_EMAIL is not set');

  sgMail.setApiKey(apiKey);

  await sgMail.send({
    from,
    to,
    subject: 'Your free PixelDropp wallpaper is here ✨',
    html: buildSubscriberHtml(downloadUrl, productName),
  });
}

export async function sendDeliveryEmail({
  to,
  products,
  downloadLinks,
  orderTotal,
}: SendDeliveryEmailParams) {
  const apiKey = process.env.SENDGRID_API_KEY;
  const from = process.env.FROM_EMAIL;
  if (!apiKey) throw new Error('SENDGRID_API_KEY is not set');
  if (!from) throw new Error('FROM_EMAIL is not set');

  sgMail.setApiKey(apiKey);

  await sgMail.send({
    from,
    to,
    subject: 'Your PixelDropp wallpapers are here',
    html: buildHtml(products, downloadLinks, orderTotal),
  });
}
