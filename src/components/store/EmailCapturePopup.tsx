'use client';

import { useEffect, useState, useRef } from 'react';
import { X } from 'lucide-react';

const STORAGE_KEY = 'pixeldrop_popup_dismissed';

export function EmailCapturePopup() {
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Never show if already dismissed or came from success page
    if (
      typeof window === 'undefined' ||
      localStorage.getItem(STORAGE_KEY) ||
      document.referrer.includes('/success')
    ) {
      return;
    }

    // 10-second timer
    timerRef.current = setTimeout(() => setVisible(true), 10_000);

    // Exit intent (desktop only — mouseleave on document element)
    function handleExitIntent(e: MouseEvent) {
      if (e.clientY <= 0) {
        setVisible(true);
        cleanup();
      }
    }
    document.addEventListener('mouseleave', handleExitIntent);

    function cleanup() {
      if (timerRef.current) clearTimeout(timerRef.current);
      document.removeEventListener('mouseleave', handleExitIntent);
    }

    return cleanup;
  }, []);

  function dismiss() {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, '1');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus('loading');
    setErrorMsg('');

    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? 'Something went wrong');

      setStatus('success');
      localStorage.setItem(STORAGE_KEY, '1');
      setTimeout(() => setVisible(false), 2000);
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  if (!visible) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        onClick={dismiss}
        aria-hidden="true"
      />

      {/* Popup */}
      <div
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4"
        style={{ animation: 'popup-slide-up 0.3s ease-out both' }}
        role="dialog"
        aria-modal="true"
        aria-label="Get a free wallpaper"
      >
        <div className="relative rounded-2xl border border-[#2a2a2a] bg-[#111111]/95 backdrop-blur-xl p-6 shadow-2xl shadow-black/60">
          {/* Close button */}
          <button
            type="button"
            onClick={dismiss}
            className="absolute top-4 right-4 text-[#6B7280] hover:text-[#EDEDED] transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>

          {status === 'success' ? (
            <div className="text-center py-4">
              <p className="text-2xl mb-2">✓</p>
              <p className="text-[#EDEDED] font-semibold">Check your inbox!</p>
              <p className="text-sm text-[#9CA3AF] mt-1">Your free wallpaper is on its way.</p>
            </div>
          ) : (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#5B21B6] mb-3">
                ✦ Free wallpaper
              </p>
              <h2 className="text-lg font-bold text-[#EDEDED] leading-snug mb-2">
                Get a free wallpaper
              </h2>
              <p className="text-sm text-[#9CA3AF] mb-5 leading-relaxed">
                Drop your email and we&apos;ll send you one of our wallpapers — free.
                No spam. Unsubscribe any time.
              </p>

              <form onSubmit={handleSubmit} className="space-y-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] px-3 py-2.5 text-sm text-[#EDEDED] placeholder:text-[#4B5563] focus:outline-none focus:ring-2 focus:ring-[#5B21B6] focus:border-transparent min-h-[44px]"
                  autoComplete="email"
                />

                {status === 'error' && (
                  <p className="text-xs text-red-400">{errorMsg}</p>
                )}

                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="w-full bg-[#5B21B6] hover:bg-[#6D28D9] disabled:opacity-60 text-white font-semibold text-sm rounded-lg px-4 py-2.5 min-h-[44px] transition-colors"
                >
                  {status === 'loading' ? 'Sending…' : 'Get my free wallpaper →'}
                </button>
              </form>

              <button
                type="button"
                onClick={dismiss}
                className="mt-3 w-full text-xs text-[#4B5563] hover:text-[#9CA3AF] transition-colors py-1"
              >
                × No thanks
              </button>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes popup-slide-up {
          from { opacity: 0; transform: translateX(-50%) translateY(24px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </>
  );
}
