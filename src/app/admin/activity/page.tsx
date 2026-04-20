'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  ShoppingCart, Eye, Monitor, Smartphone, Tablet,
  Activity, Pause, Play, ChevronUp,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { formatRelativeTime } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ActivityEvent {
  id: string;
  event_type: 'page_visit' | 'cart_add';
  session_id: string;
  page_path: string | null;
  product_name: string | null;
  device_type: string | null;
  country: string | null;
  created_at: string;
}

type EventTypeFilter = 'all' | 'page_visit' | 'cart_add';
type TimeWindow = '1h' | '24h' | '7d';
type ConnStatus = 'connecting' | 'live' | 'reconnecting';

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_FEED = 200;
const ANIM_DURATION_MS = 300;

const TIME_WINDOW_LABELS: Record<TimeWindow, string> = {
  '1h': 'Last hour',
  '24h': 'Last 24h',
  '7d': 'Last 7 days',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function sinceISO(window: TimeWindow): string {
  const offsets: Record<TimeWindow, number> = {
    '1h':  1 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d':  7 * 24 * 60 * 60 * 1000,
  };
  return new Date(Date.now() - offsets[window]).toISOString();
}

function midnightISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function eventMatchesFilter(event: ActivityEvent, filter: EventTypeFilter): boolean {
  return filter === 'all' || event.event_type === filter;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DeviceIcon({ type }: { type: string | null }) {
  if (type === 'mobile') return <Smartphone size={12} className="text-[#6B7280] shrink-0" />;
  if (type === 'tablet')  return <Tablet     size={12} className="text-[#6B7280] shrink-0" />;
  return                         <Monitor    size={12} className="text-[#6B7280] shrink-0" />;
}

function EventBadge({ type }: { type: 'page_visit' | 'cart_add' }) {
  if (type === 'cart_add') {
    return (
      <Badge variant="success" className="gap-1 shrink-0">
        <ShoppingCart size={10} />
        Cart Add
      </Badge>
    );
  }
  return (
    <Badge
      variant="neutral"
      className="gap-1 shrink-0 bg-blue-500/10 text-blue-400 border-blue-500/20"
    >
      <Eye size={10} />
      Page Visit
    </Badge>
  );
}

function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1 bg-[#111111] border border-[#1F1F1F] rounded-xl px-5 py-4 min-w-[148px]">
      <span className="text-2xl font-bold text-[#EDEDED] tabular-nums">{value}</span>
      <span className="text-xs text-[#6B7280]">{label}</span>
    </div>
  );
}

function LiveIndicator({ status }: { status: ConnStatus }) {
  if (status === 'live') {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
        </span>
        Live
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-amber-400">
      <span className="h-2 w-2 rounded-full bg-amber-400" />
      {status === 'reconnecting' ? 'Reconnecting…' : 'Connecting…'}
    </span>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminActivityPage() {
  // Feed state
  const [events, setEvents]       = useState<ActivityEvent[]>([]);
  const [loading, setLoading]     = useState(true);
  const [animIds, setAnimIds]     = useState<Set<string>>(new Set());

  // Realtime state
  const [connStatus, setConnStatus]   = useState<ConnStatus>('connecting');
  const [isPaused, setIsPaused]       = useState(false);
  const [queue, setQueue]             = useState<ActivityEvent[]>([]);

  // Filters
  const [eventType, setEventType] = useState<EventTypeFilter>('all');
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('24h');

  // Summary stats
  const [todayVisits,    setTodayVisits]    = useState(0);
  const [todayCartAdds,  setTodayCartAdds]  = useState(0);
  const [activeSessions, setActiveSessions] = useState(0);

  // Tick for timestamp refresh
  const [, setTick] = useState(0);

  // Mutable refs to avoid stale closures inside realtime callback
  const eventTypeRef       = useRef(eventType);
  const isPausedRef        = useRef(isPaused);
  // Map: sessionId -> last-seen timestamp (ms), for active-session counting
  const sessionTimestampsRef = useRef<Map<string, number>>(new Map());

  useEffect(() => { eventTypeRef.current = eventType; }, [eventType]);
  useEffect(() => { isPausedRef.current  = isPaused;  }, [isPaused]);

  // ── Active-session recalc ──────────────────────────────────────────────────

  const recalcActiveSessions = useCallback(() => {
    const cutoff = Date.now() - 15 * 60 * 1000;
    let count = 0;
    sessionTimestampsRef.current.forEach((ts) => { if (ts > cutoff) count++; });
    setActiveSessions(count);
  }, []);

  // ── Summary fetch (today) ──────────────────────────────────────────────────

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/admin/activity?since=${encodeURIComponent(midnightISO())}&limit=200`
      );
      if (!res.ok) return;
      const data: ActivityEvent[] = await res.json();
      setTodayVisits(data.filter((e) => e.event_type === 'page_visit').length);
      setTodayCartAdds(data.filter((e) => e.event_type === 'cart_add').length);

      const cutoff = Date.now() - 15 * 60 * 1000;
      data.forEach((e) => {
        const ts = new Date(e.created_at).getTime();
        const prev = sessionTimestampsRef.current.get(e.session_id) ?? 0;
        if (ts > prev) sessionTimestampsRef.current.set(e.session_id, ts);
      });
      const active = new Set(
        data.filter((e) => new Date(e.created_at).getTime() > cutoff).map((e) => e.session_id)
      );
      setActiveSessions(active.size);
    } catch { /* ignore */ }
  }, []);

  // ── Feed fetch ────────────────────────────────────────────────────────────

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ since: sinceISO(timeWindow), limit: '50' });
      if (eventType !== 'all') params.set('event_type', eventType);
      const res = await fetch(`/api/admin/activity?${params}`);
      if (!res.ok) return;
      setEvents(await res.json());
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [eventType, timeWindow]);

  useEffect(() => {
    fetchSummary();
    fetchFeed();
  }, [fetchSummary, fetchFeed]);

  // ── Realtime subscription ─────────────────────────────────────────────────

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel('activity_feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_events' },
        (payload) => {
          const newEvent = payload.new as ActivityEvent;

          // Update session timestamps and recalc active sessions
          sessionTimestampsRef.current.set(
            newEvent.session_id,
            new Date(newEvent.created_at).getTime()
          );
          recalcActiveSessions();

          // Update today's summary stats (only if event is from today)
          const eventDate = new Date(newEvent.created_at);
          const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
          if (eventDate >= midnight) {
            if (newEvent.event_type === 'page_visit') {
              setTodayVisits((n) => n + 1);
            } else if (newEvent.event_type === 'cart_add') {
              setTodayCartAdds((n) => n + 1);
            }
          }

          // If doesn't match current filter, skip feed update
          if (!eventMatchesFilter(newEvent, eventTypeRef.current)) return;

          if (isPausedRef.current) {
            setQueue((q) => [newEvent, ...q]);
            return;
          }

          // Prepend to feed (cap at MAX_FEED)
          setEvents((prev) => [newEvent, ...prev].slice(0, MAX_FEED));

          // Trigger enter animation
          setAnimIds((ids) => new Set([...ids, newEvent.id]));
          setTimeout(() => {
            setAnimIds((ids) => {
              const next = new Set(ids);
              next.delete(newEvent.id);
              return next;
            });
          }, ANIM_DURATION_MS);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED')    setConnStatus('live');
        else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT')
                                        setConnStatus('reconnecting');
        else                            setConnStatus('connecting');
      });

    return () => { supabase.removeChannel(channel); };
  }, [recalcActiveSessions]);

  // ── Flush queue ────────────────────────────────────────────────────────────

  function flushQueue() {
    if (queue.length === 0) return;
    const incoming = queue.filter((e) => eventMatchesFilter(e, eventType));
    setEvents((prev) => [...incoming, ...prev].slice(0, MAX_FEED));
    setAnimIds((ids) => new Set([...ids, ...incoming.map((e) => e.id)]));
    incoming.forEach(({ id }) => {
      setTimeout(() => {
        setAnimIds((ids) => { const n = new Set(ids); n.delete(id); return n; });
      }, ANIM_DURATION_MS);
    });
    setQueue([]);
    setIsPaused(false);
  }

  function handleTogglePause() {
    if (isPaused) {
      flushQueue();
    } else {
      setIsPaused(true);
    }
  }

  // ── 30s tick for relative timestamps ──────────────────────────────────────

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // ── Filter tabs ────────────────────────────────────────────────────────────

  const eventTypeTabs: { label: string; value: EventTypeFilter }[] = [
    { label: 'All',         value: 'all' },
    { label: 'Page Visits', value: 'page_visit' },
    { label: 'Cart Adds',   value: 'cart_add' },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#5B21B6]/10 border border-[#5B21B6]/20">
            <Activity size={20} className="text-[#A78BFA]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#EDEDED]">Activity Feed</h1>
            <p className="text-sm text-[#9CA3AF] mt-0.5">Visitors and cart events from your storefront</p>
          </div>
        </div>

        {/* Live indicator + pause/resume */}
        <div className="flex items-center gap-3">
          <LiveIndicator status={connStatus} />
          <button
            onClick={handleTogglePause}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border min-h-[36px]',
              isPaused
                ? 'bg-[#5B21B6]/20 text-[#A78BFA] border-[#5B21B6]/30 hover:bg-[#5B21B6]/30'
                : 'bg-[#111111] text-[#9CA3AF] border-[#1F1F1F] hover:text-[#EDEDED] hover:border-[#2D2D2D]'
            )}
          >
            {isPaused ? <><Play size={12} />Resume</> : <><Pause size={12} />Pause</>}
          </button>
        </div>
      </div>

      {/* Summary bar */}
      <div className="flex flex-wrap gap-3 mb-6">
        <StatChip label="Today's Visits"      value={todayVisits}    />
        <StatChip label="Today's Cart Adds"   value={todayCartAdds}  />
        <StatChip label="Active Sessions (15m)" value={activeSessions} />
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Event type tabs — scrollable on mobile */}
        <div className="flex bg-[#111111] border border-[#1F1F1F] rounded-lg p-1 gap-1 overflow-x-auto max-w-full">
          {eventTypeTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setEventType(tab.value)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap min-h-[36px]',
                eventType === tab.value
                  ? 'bg-[#5B21B6]/20 text-[#A78BFA] border border-[#5B21B6]/30'
                  : 'text-[#9CA3AF] hover:text-[#EDEDED]'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Time window dropdown */}
        <select
          value={timeWindow}
          onChange={(e) => setTimeWindow(e.target.value as TimeWindow)}
          className="bg-[#111111] border border-[#1F1F1F] text-[#9CA3AF] text-xs rounded-lg px-3 min-h-[44px] sm:min-h-[36px] focus:outline-none focus:ring-1 focus:ring-[#5B21B6]/50 cursor-pointer hover:border-[#2D2D2D] transition-colors w-full sm:w-auto"
        >
          {(Object.keys(TIME_WINDOW_LABELS) as TimeWindow[]).map((w) => (
            <option key={w} value={w}>{TIME_WINDOW_LABELS[w]}</option>
          ))}
        </select>
      </div>

      {/* Pause banner */}
      {isPaused && queue.length > 0 && (
        <button
          onClick={flushQueue}
          className="w-full flex items-center justify-center gap-2 mb-4 py-2.5 rounded-xl bg-[#5B21B6]/10 border border-[#5B21B6]/30 text-[#A78BFA] text-xs font-medium hover:bg-[#5B21B6]/20 transition-colors"
        >
          <ChevronUp size={14} />
          {queue.length} new event{queue.length !== 1 ? 's' : ''} — click to resume
        </button>
      )}

      {/* Feed */}
      <div className="space-y-2" aria-live="polite" aria-label="Activity feed">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-[#5B21B6] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-[#1F1F1F] rounded-2xl">
            <Activity size={32} className="text-[#374151] mb-3" />
            <p className="text-[#9CA3AF] text-sm font-medium">No activity yet.</p>
            <p className="text-[#4B5563] text-xs mt-1 max-w-xs">
              Events will appear here once visitors start browsing your store.
            </p>
          </div>
        ) : (
          events.map((event) => (
            <div
              key={event.id}
              className={cn(
                'flex items-start gap-3 sm:gap-4 bg-[#111111] border border-[#1F1F1F] rounded-xl px-4 sm:px-5 py-4 hover:border-[#2D2D2D] transition-colors',
                animIds.has(event.id) && 'feed-item-enter'
              )}
            >
              {/* Timestamp */}
              <span className="text-xs text-[#4B5563] shrink-0 w-[68px] pt-0.5 tabular-nums">
                {formatRelativeTime(new Date(event.created_at))}
              </span>

              {/* Badge */}
              <div className="shrink-0 pt-0.5">
                <EventBadge type={event.event_type} />
              </div>

              {/* Main content */}
              <div className="flex-1 min-w-0">
                {event.event_type === 'cart_add' ? (
                  <p className="text-sm font-semibold text-[#EDEDED] truncate">
                    {event.product_name ?? '—'}
                  </p>
                ) : (
                  <p className="text-sm font-mono text-[#A78BFA] truncate">
                    {event.page_path ?? '/'}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <DeviceIcon type={event.device_type} />
                  <span className="text-xs text-[#6B7280] capitalize">
                    {event.device_type ?? 'unknown'}
                  </span>
                  <span className="text-[#2D2D2D]" aria-hidden>·</span>
                  <span className="text-xs text-[#6B7280]">
                    {event.country ?? '—'}
                  </span>
                  <span className="text-[#2D2D2D]" aria-hidden>·</span>
                  <span className="text-xs text-[#4B5563] font-mono">
                    {event.session_id.slice(0, 10)}…
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
