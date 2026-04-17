import sgMail from '@sendgrid/mail';
import { render } from '@react-email/render';
import { DeliveryEmail } from '@/components/emails/DeliveryEmail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

interface SendDeliveryEmailParams {
  to: string;
  products: Array<{ id: string; name: string; price: number }>;
  downloadLinks: Array<{ productName: string; url: string }>;
  orderTotal: number; // in cents
}

export async function sendDeliveryEmail({
  to,
  products,
  downloadLinks,
  orderTotal,
}: SendDeliveryEmailParams) {
  const from = process.env.FROM_EMAIL;
  if (!from) throw new Error('FROM_EMAIL environment variable is not set');

  const html = await render(
    <DeliveryEmail
      products={products}
      downloadLinks={downloadLinks}
      orderTotal={orderTotal}
    />
  );

  await sgMail.send({
    from,
    to,
    subject: 'Your PixelDrop wallpapers are here 🎨',
    html,
  });
}
