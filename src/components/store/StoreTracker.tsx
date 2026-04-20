'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { trackEvent } from '@/lib/tracking';

export function StoreTracker() {
  const pathname = usePathname();

  useEffect(() => {
    trackEvent('page_visit', {
      page_path: pathname,
      referrer: document.referrer,
    });
  }, [pathname]);

  return null;
}
