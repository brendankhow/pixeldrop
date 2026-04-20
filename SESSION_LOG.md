# PixelDropp — Full Session Log

> Last updated: 2026-04-18 (Session 2)
> Working directory: `/Users/brendankhow/Desktop/PixelDrop`
> Repo: `https://github.com/brendankhow/PixelDropp.git`
> Live URL: `https://pixeldropp.vercel.app`

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router), TypeScript |
| Styling | Tailwind CSS v4 |
| Database / Auth | Supabase (Postgres + Storage) |
| Payments | Stripe Checkout + Webhooks |
| Email | SendGrid (`@sendgrid/mail`) |
| State | Zustand (cart) |
| Deployment | Vercel |
| Image processing | HTML5 Canvas API (client-side) |
| ZIP downloads | JSZip + file-saver |

---

## Session History

### 1. Git Init, GitHub Push, Vercel Deploy

- Initialised local git repo, pushed to `https://github.com/brendankhow/PixelDropp.git`
- Deployed to Vercel; wired all environment variables
- **Bug fixed**: Vercel env var trailing newline — heredoc `<<< "..."` appends `\n` to secrets causing `ERR_INVALID_CHAR` in HTTP headers. Fix: use `printf '...' | vercel env add KEY production`

---

### 2. Email — Resend → SendGrid

**Why switched**: User didn't want to buy a custom domain; Resend requires domain verification. SendGrid allows sending from a verified single sender.

**Files changed**:
- Removed `resend` SDK, installed `@sendgrid/mail`
- `src/app/api/webhooks/stripe/route.ts` — rewrote `sendDeliveryEmail` to use pure inline HTML (not JSX/react-email) and call `sgMail.setApiKey()` inside the function (not module level, which caused silent failures)

**Bugs fixed along the way**:
- `FROM_EMAIL` corrupted by heredoc newline (same fix as above)
- `react-email` JSX rendering failed silently — replaced with plain HTML string

---

### 3. Dark / Light Mode Toggle

- Added CSS custom properties (`--color-page`, `--color-fg`, etc.) in global CSS
- Tailwind v4 `@theme inline` maps utilities to those vars
- FOUC prevention: inline `<script>` in `<head>` reads `localStorage` and sets `data-theme` before first paint
- Toggle button in nav switches `data-theme` on `<html>` and persists to `localStorage`

**Semantic color classes used throughout**:

| Class | Dark | Light |
|---|---|---|
| `bg-page` | `#0A0A0A` | `#FFFFFF` |
| `bg-page-alt` | `#111111` | `#F9FAFB` |
| `bg-card` | `#111111` | `#FFFFFF` |
| `text-fg` | `#EDEDED` | `#111111` |
| `text-fg-muted` | `#9CA3AF` | `#6B7280` |
| `border-edge` | `#1F1F1F` | `#E5E7EB` |

---

### 4. Admin Image Grid (5-slot, cover selection)

- Admin product form: up to 5 image slots, one selectable as "cover" (default preview)
- Images stored in Supabase Storage bucket `product-previews` (public) and `product-files` (private)
- Cover index stored in `products` table

---

### 5. ProductImageGallery (Product Detail Page)

- Clickable thumbnail strip below main image
- Clicking thumbnail swaps the large preview
- Thumbnails highlight the active selection

---

### 6. ISR Cache Bug Fix

**Problem**: New products added via admin portal didn't appear on the storefront until Vercel's ISR window (1 hour) expired.

**Fix**: Added `revalidatePath` calls in admin API routes after every DB mutation:

```ts
// src/app/api/admin/products/route.ts
// src/app/api/admin/products/[id]/route.ts
import { revalidatePath } from 'next/cache';

// After create / update / delete:
revalidatePath('/');
revalidatePath('/products/[slug]', 'page');
```

---

### 7. Product Card & Grid Consistency

- All product cards: `aspect-video` + `shrink-0` (no more tall portrait iPhone cards)
- Removed "Buy Now" from product cards entirely
- Category label: `iphone → 'Smartphone'` everywhere (ProductCard, ProductGrid, product detail page)

---

### 8. Brand Rename: PixelDrop → PixelDropp

- Two p's — updated across all files, metadata, og tags, email templates
- macOS `sed` doesn't support `\b` word boundary — used two-pass replace to avoid doubling the `p`

---

### 9. Homepage Redesign (platsupply.com-inspired)

**`src/app/(store)/page.tsx`** structure:

1. **Hero** — gradient blobs, "Beautiful wallpapers for every screen", "Shop Wallpapers" CTA button
2. **Trust bar** — `✓ Instant email delivery · ✓ High resolution · ✓ Secure checkout`
3. **Featured product** — `products[0]` shown large (image left, name/price/buttons right, "New drop" badge), `bg-page-alt` background
4. **Full catalogue grid**

---

### 10. Product Detail Page Redesign

- **Buy Now** + **Add to Cart** side-by-side in a `flex` row
- `BuyNowButton` component (`src/components/store/BuyNowButton.tsx`) — calls `/api/checkout` with single item, `bg-fg text-page` styling, Zap icon
- Trust bullets replaced with 2×2 icon grid: Zap (instant), Download (high-res), Shield (secure), Clock (lifetime access)
- Related products: 4 columns on large screens (`lg:grid-cols-4`)

---

### 11. Stripe Checkout Back Button Fix

**Problem**: Stripe back button redirected to `/cart` which was a blank stub page.

**Fix** in `src/app/api/checkout/route.ts`:
```ts
// Before
cancel_url: `${siteUrl}/cart`

// After
cancel_url: `${siteUrl}/`
```

---

### 12. Playground Feature — Phase 1

**Nav**: Added `Wand2` icon + `{ label: 'Playground', href: '/admin/playground' }` to `AdminSidebar.tsx`

**New files**:
- `src/app/admin/playground/page.tsx` — page shell, source image state, empty state with UploadZone
- `src/components/admin/playground/UploadZone.tsx` — drag-drop or click-to-upload, accepts JPG/PNG/WebP, loads `HTMLImageElement` to read natural dimensions

```ts
export interface SourceImage {
  file: File;
  objectUrl: string;
  element: HTMLImageElement;
  width: number;
  height: number;
}
```

**Once image is loaded**:
- Compact source bar replaces the upload zone (thumbnail + filename + dimensions + "Replace image" button)
- Low-res warning (< 2000 × 2000 px) shown as amber banner — desktop inline, mobile below bar

---

### 13. Playground Feature — Phase 2

**New files**:
- `src/components/admin/playground/FormatCard.tsx`
- `src/components/admin/playground/FormatTabs.tsx`

#### FormatCard

```ts
export interface CropState {
  offsetX: number; // pan in full-resolution target pixels (0 = centred)
  offsetY: number;
  scale: number;   // zoom multiplier (1 = cover-fill, ≥ 1)
}
export const DEFAULT_CROP: CropState = { offsetX: 0, offsetY: 0, scale: 1 };
```

**Preview sizing**:
```ts
const MAX_PREVIEW_W = 260;
const MAX_PREVIEW_H = 380;
const previewScale = Math.min(MAX_PREVIEW_W / targetWidth, MAX_PREVIEW_H / targetHeight);
```

**Cover-fill crop math**:
```ts
const coverScale = Math.max(targetWidth / src.naturalWidth, targetHeight / src.naturalHeight);
const totalScale = coverScale * cropState.scale * previewScale;
```

**Offset clamping** (image must always cover canvas):
```ts
const maxX = Math.max(0, (drawnW - targetWidth) / 2);
offsetX = Math.max(-maxX, Math.min(maxX, rawX));
```

**Stable closure pattern** (prevents stale state in `window` event listeners):
```ts
const sourceImageRef = useRef(sourceImage);
useEffect(() => { sourceImageRef.current = sourceImage; }, [sourceImage]);
// same for cropStateRef, onCropChangeRef
```

**Single PNG download**: offscreen canvas at full resolution, `setTimeout(50ms)` defers heavy work to let React paint the spinner first

#### FormatTabs

3 tabs: **Smartphones** (7 formats) · **Desktop** (1) · **Posters** (1)

Toolbar per tab:
- Left: "Copy crop to all" (applies first card's crop to all others in the tab)
- Right: Batch download button for the tab

---

### 14. Playground Feature — Phase 3

**New files**:
- `src/lib/playground/formats.ts`
- `src/components/admin/playground/BatchDownloadButton.tsx`

**Updated files**:
- `src/components/admin/playground/FormatTabs.tsx`
- `src/app/admin/playground/page.tsx`

#### formats.ts

Centralised format registry and shared `renderToBlob` utility:

```ts
export interface FormatConfig { label: string; slug: string; w: number; h: number; }

export const SMARTPHONE_FORMATS: FormatConfig[] = [
  { label: 'iPhone 16 Pro Max · 1320 × 2868',       slug: 'iphone16promax', w: 1320, h: 2868 },
  { label: 'iPhone 16 Pro · 1206 × 2622',            slug: 'iphone16pro',    w: 1206, h: 2622 },
  { label: 'iPhone 16 / 16 Plus · 1179 × 2556',      slug: 'iphone16',       w: 1179, h: 2556 },
  { label: 'iPhone 15 Pro Max · 1290 × 2796',        slug: 'iphone15promax', w: 1290, h: 2796 },
  { label: 'Samsung Galaxy S25 Ultra · 1440 × 3088', slug: 's25ultra',       w: 1440, h: 3088 },
  { label: 'Samsung Galaxy S25+ · 1440 × 3120',      slug: 's25plus',        w: 1440, h: 3120 },
  { label: 'Samsung Galaxy S25 · 1080 × 2340',       slug: 's25',            w: 1080, h: 2340 },
];
export const DESKTOP_FORMATS: FormatConfig[] = [
  { label: '4K UHD Universal · 3840 × 2160', slug: 'desktop4k', w: 3840, h: 2160 },
];
export const POSTER_FORMATS: FormatConfig[] = [
  { label: '4K Portrait Poster · 2160 × 3840', slug: 'poster4k', w: 2160, h: 3840 },
];
export const ALL_FORMATS = [...SMARTPHONE_FORMATS, ...DESKTOP_FORMATS, ...POSTER_FORMATS];
```

`renderToBlob` uses `imageSmoothingQuality: 'high'` and exports PNG at 1.0 quality.

#### BatchDownloadButton

Sequential rendering loop (not parallel — avoids holding 9 full-res canvases in memory simultaneously):

```ts
for (let i = 0; i < formats.length; i++) {
  const fmt = formats[i];
  setCurrent(i + 1);  // shows "Rendering 3/9…"
  const cropState = cropStates[fmt.slug] ?? DEFAULT_CROP;
  const blob = await renderToBlob(sourceImage, fmt.w, fmt.h, cropState);
  zip.file(`pixeldrop-${fmt.slug}.png`, blob);
}
const zipBlob = await zip.generateAsync({ type: 'blob' });
saveAs(zipBlob, zipFilename);
```

`prominent` prop: larger "Download Everything" button style vs. subtle inline tab button

#### "Download Everything" section (page.tsx)

Always rendered at the bottom of the page — active when image is loaded, disabled (with helper text) when not:

```tsx
<BatchDownloadButton
  sourceImage={source?.element ?? null}
  formats={ALL_FORMATS}
  cropStates={cropStates}
  zipFilename="pixeldrop-all-formats.zip"
  label="Download Everything (9 formats)"
  prominent
/>
```

---

## Key File Map

```
src/
├── app/
│   ├── (store)/
│   │   ├── page.tsx                          # Homepage (hero + trust bar + featured + grid)
│   │   └── products/[slug]/page.tsx          # Product detail (Buy Now + Add to Cart + trust grid)
│   ├── admin/
│   │   └── playground/
│   │       └── page.tsx                      # Playground page
│   └── api/
│       ├── checkout/route.ts                 # Stripe checkout (cancel_url → /)
│       ├── webhooks/stripe/route.ts          # Stripe webhook + SendGrid email
│       └── admin/products/
│           ├── route.ts                      # revalidatePath after create
│           └── [id]/route.ts                 # revalidatePath after update/delete
├── components/
│   ├── admin/
│   │   ├── AdminSidebar.tsx                  # Nav with Playground link
│   │   └── playground/
│   │       ├── UploadZone.tsx                # Drag-drop image loader
│   │       ├── FormatCard.tsx                # Canvas preview + drag-pan + zoom + single download
│   │       ├── FormatTabs.tsx                # 3 tabs, copy-crop-to-all, batch download per tab
│   │       └── BatchDownloadButton.tsx       # ZIP renderer with progress counter
│   └── store/
│       ├── ProductCard.tsx                   # aspect-video, no Buy Now
│       ├── ProductGrid.tsx                   # Smartphone tab, semantic colors
│       └── BuyNowButton.tsx                  # Single-item Stripe checkout, Zap icon
└── lib/
    └── playground/
        └── formats.ts                        # FormatConfig, all 9 formats, renderToBlob
```

---

## Environment Variables

| Variable | Where set | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel + `.env.local` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel + `.env.local` | Supabase public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel + `.env.local` | Server-side Supabase access |
| `STRIPE_SECRET_KEY` | Vercel + `.env.local` | Stripe server key |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Vercel + `.env.local` | Stripe public key |
| `STRIPE_WEBHOOK_SECRET` | Vercel + `.env.local` | Webhook signature verification |
| `SENDGRID_API_KEY` | Vercel + `.env.local` | SendGrid email delivery |
| `FROM_EMAIL` | Vercel + `.env.local` | Verified SendGrid sender address |
| `NEXT_PUBLIC_SITE_URL` | Vercel + `.env.local` | Full site URL (for redirects, OG tags) |

> **Warning**: Always set env vars with `printf 'value' | vercel env add KEY production` — never use heredoc `<<<` as it appends a trailing newline that corrupts HTTP headers.

---

## Common Bugs & Fixes

| Bug | Root Cause | Fix |
|---|---|---|
| New products not on storefront | ISR cache (1hr TTL) | `revalidatePath('/')` in admin API routes |
| Stripe back button → blank page | `cancel_url` pointed to stub `/cart` route | Change to `cancel_url: siteUrl + '/'` |
| Email not sending | `sgMail.setApiKey()` at module level failed silently; react-email JSX render error | Move API key init inside function; use plain HTML string |
| Env vars corrupt (`ERR_INVALID_CHAR`) | Heredoc `<<<` adds trailing newline to secret | Use `printf '...' \| vercel env add KEY production` |
| Brand rename sed failure | macOS `sed` doesn't support `\b` | Two-pass: replace new name with placeholder, then old with new, then restore placeholder |
| Stale closure in canvas drag | `window.addEventListener` captures initial state | `useRef` pattern updated via `useEffect` |

---

## Playground — How It Works (End-to-End)

1. User drops/clicks an image → `UploadZone` creates an `objectUrl` and loads an `HTMLImageElement`
2. Page stores `SourceImage` in state; compact source bar replaces upload zone
3. `FormatTabs` renders 3 tabs; each tab shows a grid of `FormatCard` components
4. Each `FormatCard` draws a preview canvas using cover-fill math scaled to `MAX_PREVIEW_W × MAX_PREVIEW_H`
5. User drags the canvas to pan, uses the slider to zoom; `CropState` is lifted to page-level state
6. "Copy crop to all" copies the first card's `CropState` to all other cards in the current tab
7. "Download PNG" on a card: renders full-resolution offscreen canvas → `toBlob()` → anchor click download
8. "Download All [Tab]" button: sequential async loop, adds each PNG to a JSZip, triggers ZIP download
9. "Download Everything": same as above but iterates `ALL_FORMATS` (all 9), saves `pixeldrop-all-formats.zip`

---

### 15. Fix 413 Content Too Large on Product Creation

**Problem**: Uploading Gemini-generated wallpapers (4K PNG files, can be 10–50 MB) through the admin portal returned `413 FUNCTION_PAYLOAD_TOO_LARGE`. Vercel serverless functions have a hard 4.5 MB body limit.

**Root cause**: `ProductForm.tsx` was sending raw file blobs inside FormData directly to `/api/admin/products`, so all file bytes went through the Vercel function.

**Fix**: Client-side direct upload to Supabase Storage, then pass only storage paths to the API.

**New file**:
- `src/app/api/admin/upload-url/route.ts` — POST endpoint (auth-gated). Takes `{ bucket, filename }`, uses the service-role client to call `storage.createSignedUploadUrl()`, returns `{ signedUrl, path, token }`.

**Updated files**:
- `src/components/admin/ProductForm.tsx` — Added `uploadFileDirect(bucket, file)` helper. Before submitting, each new file is:
  1. POSTed to `/api/admin/upload-url` → signed URL + token
  2. Uploaded directly via `supabase.storage.from(bucket).uploadToSignedUrl(path, token, file)` (browser → Supabase, no Vercel hop)
  3. Its storage `path` is collected. FormData now sends paths (strings), not file blobs.
- `src/app/api/admin/products/route.ts` — POST now reads `preview_image_path`, `deliverable_file_path`, `new_additional_paths` (JSON string of paths). Derives public URLs via `getPublicUrl()`. Removed `uploadToStorage` helper entirely.
- `src/app/api/admin/products/[id]/route.ts` — PATCH updated identically. Removed `uploadToStorage` helper.

**Key fields changed in FormData** (client → API):

| Old (file blob) | New (storage path string) |
|---|---|
| `preview_image` (File) | `preview_image_path` (string) |
| `deliverable_file` (File) | `deliverable_file_path` (string) |
| `additional_images[]` (File[]) | `new_additional_paths` (JSON string[]) |

---

## Next Steps / Ideas

- [ ] Touch / pinch-zoom support for FormatCard (mobile)
- [ ] JPEG export option (smaller file sizes for sharing)
- [ ] Add more device formats (iPad, MacBook wallpaper)
- [ ] Storefront: customer order history page
- [ ] Storefront: bundle products (multi-product checkout)
