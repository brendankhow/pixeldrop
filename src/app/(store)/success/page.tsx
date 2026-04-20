import { redirect } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, ExternalLink } from 'lucide-react';
import { stripe } from '@/lib/stripe';
import { formatPrice } from '@/lib/utils';
import { ClearCartOnSuccess } from '@/components/store/ClearCartOnSuccess';

interface SuccessPageProps {
  searchParams: Promise<{ session_id?: string }>;
}

export default async function SuccessPage({ searchParams }: SuccessPageProps) {
  const { session_id } = await searchParams;

  if (!session_id) {
    redirect('/');
  }

  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ['line_items'],
    });
  } catch {
    redirect('/');
  }

  if (!session || session.status !== 'complete') {
    redirect('/');
  }

  const email = session.customer_details?.email ?? 'your inbox';
  const amountTotal = session.amount_total ?? 0;
  const lineItems = session.line_items?.data ?? [];

  const shareUrl =
    'https://twitter.com/intent/tweet?text=Just+grabbed+some+beautiful+wallpapers+from+%40PixelDropp+%F0%9F%8E%A8&url=https%3A%2F%2Fpixeldrop.com';

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-16">
      <ClearCartOnSuccess />
      <div className="w-full max-w-lg mx-auto text-center">

        {/* Checkmark */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-xl scale-150" />
            <CheckCircle2
              size={80}
              className="relative text-emerald-400"
              strokeWidth={1.5}
            />
          </div>
        </div>

        {/* Heading */}
        <h1 className="text-3xl sm:text-4xl font-bold text-fg mb-3">
          Payment successful!
        </h1>

        <p className="text-lg text-fg-muted mb-2">
          We&apos;re sending your wallpapers to{' '}
          <span className="text-fg font-medium">{email}</span>
        </p>
        <p className="text-sm text-fg-faint mb-10">
          They&apos;ll arrive within 1–2 minutes. Check your spam folder too.
        </p>

        {/* Order summary card */}
        <div className="bg-card border border-edge rounded-2xl p-6 mb-8 text-left">
          <h2 className="text-sm font-semibold text-fg-muted uppercase tracking-wider mb-4">
            Order Summary
          </h2>

          {lineItems.length > 0 ? (
            <ul className="space-y-3 mb-5">
              {lineItems.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-4"
                >
                  <span className="text-sm text-fg truncate">
                    {item.description ?? item.price?.product?.toString() ?? 'Product'}
                    {item.quantity && item.quantity > 1 && (
                      <span className="text-fg-faint ml-1">× {item.quantity}</span>
                    )}
                  </span>
                  <span className="text-sm font-medium text-fg shrink-0">
                    {formatPrice(item.amount_total ?? 0)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="border-t border-edge pt-4 flex items-center justify-between">
            <span className="text-sm text-fg-muted">Total paid</span>
            <span className="text-xl font-bold text-fg">
              {formatPrice(amountTotal)}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {/* Share on X */}
          <a
            href={shareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-edge border border-edge-2 text-fg text-sm font-medium hover:bg-[#2D2D2D] transition-colors min-h-[48px]"
          >
            Share on X
            <ExternalLink size={14} />
          </a>

          {/* Browse more */}
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#5B21B6] text-white text-sm font-semibold hover:bg-[#6D28D9] transition-colors min-h-[48px]"
          >
            Browse more wallpapers
          </Link>
        </div>

        {/* Footnote */}
        <p className="mt-8 text-xs text-fg-faint">
          Download links expire in 48 hours. If you don&apos;t receive an email, reply to
          your order confirmation and we&apos;ll resend it.
        </p>
      </div>
    </div>
  );
}
