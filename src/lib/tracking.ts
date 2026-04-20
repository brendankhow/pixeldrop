'use client';

const SESSION_KEY = 'pixeldrop_session_id';
const VISIT_CACHE_PREFIX = 'pixeldrop_visit_';
const VISIT_DEBOUNCE_MS = 30_000;

export function getOrCreateSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = 'sess_' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function getDeviceType(ua: string): 'mobile' | 'tablet' | 'desktop' {
  if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet';
  if (/mobile|iphone|ipod|android|blackberry|mini|windows\sce|palm/i.test(ua)) return 'mobile';
  return 'desktop';
}

export function trackEvent(
  type: 'page_visit' | 'cart_add',
  payload: Record<string, unknown>
): void {
  try {
    const sessionId = getOrCreateSessionId();
    const ua = navigator.userAgent;
    const deviceType = getDeviceType(ua);

    if (type === 'page_visit') {
      const path = (payload.page_path as string) ?? '';
      const cacheKey = VISIT_CACHE_PREFIX + btoa(path).slice(0, 32);
      const lastFired = localStorage.getItem(cacheKey);
      if (lastFired && Date.now() - parseInt(lastFired, 10) < VISIT_DEBOUNCE_MS) return;
      localStorage.setItem(cacheKey, String(Date.now()));
    }

    // Fire-and-forget — intentionally not awaited
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: type,
        session_id: sessionId,
        user_agent: ua,
        device_type: deviceType,
        ...payload,
      }),
    }).catch(() => {/* swallow network errors */});
  } catch {
    // Never let tracking break the UI
  }
}
