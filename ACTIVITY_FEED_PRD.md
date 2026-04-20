# PixelDrop — Visitor & Cart Activity Feed
**Feature:** Real-Time Activity Feed  
**Route:** `/admin/activity`  
**Version:** 1.0 | **Status:** Ready for Engineering  
**Stack:** Existing (Next.js · Supabase · Tailwind) — no new infrastructure required

---

## 1. Overview

### 1.1 What This Is
A live activity feed inside the admin portal that shows two types of events:
- **Page Visit** — a user landed on the public storefront
- **Cart Add** — a user added a product to their cart

The admin can watch this feed in real time to understand store traffic and buyer intent, without needing a third-party analytics tool.

### 1.2 What This Is Not
- Not a full analytics dashboard (that's `/admin/dashboard` — revenue/orders)
- Not session recording or heatmaps
- Not user identification — visitors are anonymous (tracked by a session ID stored in `localStorage`)
- Not persistent user accounts

### 1.3 Goals
- Zero impact on public storefront performance (events fire async, non-blocking)
- No third-party analytics service — everything stored in Supabase
- Real-time feed in the admin using Supabase Realtime subscriptions
- Simple to extend with new event types later (e.g. checkout started, product viewed)

---

## 2. Data Model

### 2.1 New Table: `activity_events`

```sql
create table activity_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,         -- 'page_visit' | 'cart_add'
  session_id text not null,         -- anonymous ID from localStorage (e.g. "sess_abc123")
  page_path text,                   -- e.g. '/' or '/products/neon-bloom'
  product_id uuid references products(id) on delete set null,  -- only for cart_add
  product_name text,                -- denormalised for display (cart_add only)
  referrer text,                    -- document.referrer at time of event
  user_agent text,                  -- raw UA string
  device_type text,                 -- 'mobile' | 'desktop' | 'tablet' — derived from UA
  country text,                     -- derived from IP via Supabase Edge Function (Phase 2)
  created_at timestamptz default now()
);

-- Index for fast feed queries
create index activity_events_created_at_idx on activity_events(created_at desc);
create index activity_events_session_id_idx on activity_events(session_id);
```

### 2.2 Supabase Row Level Security
- Anonymous (public) role: **INSERT only** — visitors can write events, never read them
- Service role (admin API): full access
- Authenticated admin: SELECT only via the admin portal

---

## 3. Event Tracking — Public Storefront

### 3.1 Session ID
On any public page load, check `localStorage` for `pixeldrop_session_id`. If absent, generate one (`sess_` + nanoid) and store it. This persists across pages within the same browser/device.

### 3.2 Events to Track

| Event | Trigger | Key Fields |
|-------|---------|-----------|
| `page_visit` | Any public page mounts (layout or page component) | `page_path`, `referrer`, `session_id`, `user_agent` |
| `cart_add` | User clicks "Add to Cart" / "Buy Now" on any product | `product_id`, `product_name`, `session_id` |

### 3.3 Tracking Function
A single shared utility `trackEvent(type, payload)` that:
1. Reads or initialises `session_id` from `localStorage`
2. Detects `device_type` from `navigator.userAgent`
3. POSTs to `/api/track` (a Next.js API route)
4. **Fire-and-forget** — never awaited, never blocks UI

### 3.4 API Route: `POST /api/track`
- Accepts: `{ event_type, session_id, page_path?, product_id?, product_name?, referrer?, user_agent? }`
- Inserts directly into `activity_events` via Supabase service role client
- Returns `200 OK` always (never exposes errors to client)
- Rate limit: max 10 inserts per session per minute (simple in-memory check or Supabase RLS policy)

**Deduplication for page_visit:** Do not fire a `page_visit` event if the same `session_id` fired one for the same `page_path` within the last 30 seconds (check in `localStorage` timestamp cache).

---

## 4. Admin UI — Activity Feed Page

### 4.1 Route
`/admin/activity` — protected by existing admin auth middleware.

Add to admin nav: Dashboard · Products · Orders · Playground · **Activity**  
Icon: `Activity` or `Radio` from lucide-react (pulsing dot suggests live)

### 4.2 Page Layout

```
┌─────────────────────────────────────────────────────┐
│  Activity Feed                    ● Live  [Pause]   │
│  Visitors and cart events in real time              │
├─────────────────────────────────────────────────────┤
│  Today: 24 visits · 8 cart adds · 3 sessions active │
├─────────────────────────────────────────────────────┤
│  [All] [Page Visits] [Cart Adds]      [Last 24h ▾]  │
├─────────────────────────────────────────────────────┤
│  ● 2 min ago  🛒 Cart Add                           │
│    Neon Bloom Wallpaper Pack                        │
│    Mobile · Singapore · sess_abc1                   │
│                                                     │
│  ● 3 min ago  👁 Page Visit                         │
│    /products/aurora-desktop                         │
│    Desktop · Unknown · sess_xyz9                    │
│                                                     │
│  ... (scrollable feed)                              │
└─────────────────────────────────────────────────────┘
```

### 4.3 Summary Bar
Three stat chips updated in real time:
- **Today's Visits** — count of `page_visit` events since midnight
- **Today's Cart Adds** — count of `cart_add` events since midnight
- **Active Sessions** — distinct `session_id` values with an event in the last 15 minutes

### 4.4 Feed Items

Each feed row shows:
- Relative timestamp ("2 min ago", "just now") — updates live
- Event type badge: 🛒 **Cart Add** (green) or 👁 **Page Visit** (blue/grey)
- For `cart_add`: product name
- For `page_visit`: page path
- Device type icon (mobile/desktop/tablet)
- Country (Phase 2 — show "—" until then)
- Truncated session ID (e.g. `sess_abc1...`)

### 4.5 Filters
- Event type: All · Page Visits · Cart Adds
- Time window: Last hour · Last 24h · Last 7 days
- Filter does not affect the real-time live stream (new events always appear at top)

### 4.6 Real-Time Behaviour
- Uses **Supabase Realtime** subscription on the `activity_events` table
- New events animate in at the top of the feed (slide-down with fade)
- **Pause / Resume** toggle — when paused, new events are queued and a banner shows "X new events — click to load"
- Feed is capped at 200 items in the DOM; older items are removed as new ones arrive

---

## 5. Phases

---

### Phase 1 — Data Layer + Tracking API

**Scope:** Backend only. No UI yet.

**Deliverables:**

1. Create the `activity_events` table in Supabase with the schema from Section 2.1. Add the two indexes. Apply RLS policy: anon role INSERT only.

2. Create a shared tracking utility at `/lib/tracking.ts`:
   - `getOrCreateSessionId()` — reads/creates `pixeldrop_session_id` in localStorage
   - `getDeviceType(ua: string)` — returns `'mobile' | 'desktop' | 'tablet'`
   - `trackEvent(type: 'page_visit' | 'cart_add', payload)` — fire-and-forget POST to `/api/track`
   - Page visit deduplication logic (30-second localStorage cache keyed by path)

3. Create the API route `/api/track` (POST):
   - Validate input with zod (or basic manual checks — no new packages needed if zod is already installed)
   - Insert into `activity_events` via supabase service role client
   - Always return `{ ok: true }` with status 200

4. Wire `page_visit` tracking into the public layout (`/app/(public)/layout.tsx` or equivalent). Should fire once per path change.

5. Wire `cart_add` tracking into the existing cart add handler — fire `trackEvent('cart_add', { product_id, product_name })` alongside the existing cart state update.

**Test:** Use Supabase Table Editor to confirm events are appearing in `activity_events` when browsing the public storefront and clicking "Add to Cart".

**Do not build any admin UI in this phase.**

---

### Phase 2 — Admin Activity Feed UI

**Scope:** Admin page with static feed (no real-time yet). Phase 1 must be complete.

**Deliverables:**

1. Add "Activity" to the admin nav (after Playground). Icon: `Activity` from lucide-react.

2. Create `/admin/activity/page.tsx` — protected by existing auth middleware.

3. Create an API route `GET /api/admin/activity`:
   - Query params: `event_type` (optional), `since` (ISO timestamp, optional), `limit` (default 50, max 200)
   - Returns events sorted by `created_at DESC`
   - Protected: only callable with admin session (check Supabase auth server-side)

4. Build the page with:
   - Summary bar (Today's Visits, Today's Cart Adds, Active Sessions) — fetched once on load
   - Feed list of events with all fields per Section 4.4. Country shows "—" for now.
   - Filter tabs: All · Page Visits · Cart Adds
   - Time window selector: Last hour · Last 24h · Last 7 days
   - Relative timestamps ("2 min ago") using a simple `formatRelative` utility — update every 30 seconds via `setInterval`

5. Empty state: "No activity yet. Events will appear here once visitors start browsing your store."

**Country field:** Leave as "—" in this phase. Do not add geo-IP logic yet.

**No real-time subscription yet** — the feed loads on mount and re-fetches when filters change. Real-time is Phase 3.

**Test:** Confirm feed loads with existing events from Phase 1, filters work, and timestamps update.

---

### Phase 3 — Real-Time Feed + Polish

**Scope:** Add Supabase Realtime subscription, live animations, and final polish. Phases 1 and 2 must be complete.

**Deliverables:**

1. Add a Supabase Realtime subscription in the Activity page component:
   ```typescript
   supabase
     .channel('activity_feed')
     .on('postgres_changes', {
       event: 'INSERT',
       schema: 'public',
       table: 'activity_events'
     }, handleNewEvent)
     .subscribe()
   ```
   Clean up subscription on component unmount.

2. New events animate into the top of the feed:
   - Slide down + fade in (CSS transition, ~200ms)
   - A pulsing green "● Live" indicator in the page header when the subscription is active
   - If subscription drops, show "● Reconnecting…" in amber

3. Pause / Resume toggle button:
   - When paused, incoming events are held in a queue (not added to DOM)
   - A banner appears: "▲ 3 new events — click to resume"
   - Clicking the banner or Resume flushes the queue into the feed with animation

4. Update the summary bar stats in real time as new events arrive (increment counts client-side without refetching).

5. Cap the feed at 200 DOM items — remove oldest entries as new ones arrive.

6. Final polish pass:
   - Ensure consistent card/badge styles with the rest of the admin portal
   - Mobile layout: feed cards stack cleanly, filter tabs scroll horizontally on small screens
   - No console errors or React key warnings
   - Accessibility: feed items have appropriate aria labels, live region (`aria-live="polite"`) on the feed container for screen readers

**Test:** Open admin activity page and public storefront side by side. Browsing and adding to cart on the storefront should produce live events in the admin feed within ~1 second.

---

## 6. Routes Summary

| Route | Type | Description |
|-------|------|-------------|
| `POST /api/track` | Public API | Receives events from the storefront |
| `GET /api/admin/activity` | Admin API | Returns paginated event feed |
| `/admin/activity` | Admin page | Real-time activity feed UI |

---

## 7. Environment Variables

No new environment variables required. Uses existing:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — for public INSERT events
- `SUPABASE_SERVICE_ROLE_KEY` — for the `/api/track` server-side insert

---

## 8. Acceptance Criteria

| # | Scenario | Expected Result |
|---|----------|-----------------|
| 1 | Visitor lands on `/` | `page_visit` event inserted within 1s |
| 2 | Visitor revisits same page within 30s | No duplicate event fired |
| 3 | Visitor adds a product to cart | `cart_add` event inserted with correct product_id and name |
| 4 | Admin opens `/admin/activity` | Feed loads with recent events, summary stats correct |
| 5 | Admin filters to "Cart Adds" | Only cart_add events shown |
| 6 | New event fires while admin is on the page | Event animates in at the top within ~1 second |
| 7 | Admin pauses the feed | New events queue up, banner shows count |
| 8 | Admin resumes the feed | Queued events flush into the feed with animation |
| 9 | Subscription drops (network blip) | Amber "Reconnecting…" indicator shown |
| 10 | Unauthenticated GET to `/api/admin/activity` | 401 Unauthorized |
