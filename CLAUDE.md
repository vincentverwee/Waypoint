# Waypoint — Travel Tracking App

Personal road trip journal. Single-user, no auth. Tracks routes, km driven, generates Instagram maps.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js (App Router) + TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Animation | Framer Motion |
| Maps | MapLibre GL + OpenStreetMap |
| Routing engine | OSRM (real driving distances) |
| Database | Supabase PostgreSQL |
| Deployment | Vercel + GitHub |
| PWA | next-pwa |

---

## Folder Structure

```
src/
├── app/
│   ├── layout.tsx          # Root layout (fonts, theme, providers)
│   ├── page.tsx            # Dashboard (home)
│   ├── globals.css
│   ├── trips/
│   │   ├── page.tsx        # All trips list
│   │   └── [id]/
│   │       └── page.tsx    # Single trip detail
│   ├── map/
│   │   └── page.tsx        # Full world map
│   └── stats/
│       └── page.tsx        # Statistics page
├── components/
│   ├── ui/                 # shadcn/ui auto-generated
│   ├── layout/
│   │   ├── AppShell.tsx    # Wraps sidebar + content
│   │   ├── Sidebar.tsx     # Desktop nav
│   │   └── BottomNav.tsx   # Mobile nav
│   ├── dashboard/
│   │   └── StatsCard.tsx
│   ├── trips/
│   │   ├── TripCard.tsx
│   │   └── TripForm.tsx
│   ├── map/
│   │   └── MapView.tsx     # MapLibre wrapper
│   └── shared/
│       └── ThemeToggle.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts       # Browser Supabase client
│   │   └── server.ts       # Server Supabase client
│   ├── routing/
│   │   └── osrm.ts         # OSRM distance calculations
│   └── utils.ts
├── types/
│   └── index.ts            # All shared TypeScript types
└── hooks/
    ├── useTrips.ts
    └── useLocations.ts
```

---

## Database Schema

### trips
```sql
CREATE TABLE trips (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  start_date DATE,
  end_date DATE,
  cover_image TEXT,
  total_km DECIMAL(10,2) DEFAULT 0,
  route_preference TEXT DEFAULT 'allow_tolls' CHECK (route_preference IN ('allow_tolls', 'avoid_tolls')),
  route_geometry JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### locations
```sql
CREATE TABLE locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  country TEXT,
  city TEXT,
  arrival_date DATE,
  departure_date DATE,
  notes TEXT,
  visit_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### route_segments
```sql
CREATE TABLE route_segments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  from_location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  to_location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  distance_km DECIMAL(10,2),
  route_geometry JSONB,
  avoid_tolls BOOLEAN DEFAULT FALSE,
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);
```
Exists in the schema but is currently unused — Milestone 3 stores one whole-trip route on `trips.route_geometry` instead of per-leg segments. Revisit this table if Milestone 5's per-stop "km to next stop" requirement needs individual leg distances/geometry.

---

## Environment Variables

Create `.env.local` from `.env.local.example`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

The app uses **mock data** when Supabase is not configured (for local dev without credentials).

---

## Running Locally

```bash
npm install
npm run dev
# → http://localhost:3000
```

---

## Design System

- **Inspiration:** Apple, Airbnb, Notion
- **Colors:** Neutral slate palette, accent indigo/violet
- **Typography:** Geist Sans (Next.js default)
- **Modes:** Dark + Light (next-themes)
- **Radius:** rounded-2xl for cards, rounded-xl for buttons
- **Motion:** Framer Motion for page transitions and card animations

---

## Milestones

### ✅ Milestone 1 — Foundation
- [x] Next.js project initialized
- [x] Tailwind + shadcn/ui + Framer Motion
- [x] Supabase client setup
- [x] Database schema SQL
- [x] Dashboard skeleton with mock stats
- [x] Responsive layout (sidebar desktop, bottom nav mobile)
- [x] Dark/light mode
- [x] MapLibre stub
- [x] PWA manifest
- [x] CLAUDE.md

### ✅ Milestone 2 — Trip Management
- [x] Trips list page with create/edit/delete
- [x] TripDialog (create & edit form with dates, description, route preference)
- [x] TripCard with hover actions (edit, delete with confirmation)
- [x] Trip detail page with locations panel + route map
- [x] LocationSearch with Nominatim geocoding (OpenStreetMap, debounced)
- [x] LocationList with up/down reordering, expandable dates & notes
- [x] Data layer: createTrip / updateTrip / deleteTrip / getTripWithLocations (mock, Supabase-ready)
- [x] Supabase CRUD wiring (trips + locations; falls back to mock data when .env.local is unset)

### ✅ Milestone 3 — Maps & Routing
- [x] MapLibre interactive map: numbered, color-coded markers + popups (name, dates, notes), auto-fit bounds — on trip detail, dashboard, and `/map`
- [x] OSRM real driving distances (`src/lib/routing/osrm.ts`), recalculated live whenever a trip's locations change
- [x] Route lines on map (actual road-following geometry, not straight lines)
- [ ] Toll road preference — **not actually implemented**: the public OSRM demo server rejects `exclude=toll` and `exclude=motorway` (400 "Exclude flag combination is not supported"). `route_preference` is stored and shown in the UI but has no effect on the calculated route. Real toll avoidance needs a different routing backend (GraphHopper/Valhalla with toll tagging).

### Debugging a little bit
- [x] Map markers numbered out of order / route line missing on the dashboard and `/map` — two root causes: `getAllLocations()` had no `ORDER BY` (Postgres doesn't guarantee row order without one, so trip_id/visit_order came back scrambled), and `MapView` only ever supported a single route line while multi-trip views need one per trip. Fixed: `getAllLocations()` now orders by `trip_id, visit_order`; `MapView` numbers markers per-trip (not by combined-array index) and accepts a `routes` prop — one colored `LineString` per trip — used by the dashboard and `/map` (trip detail still uses the single `routeGeometry` prop, unchanged).

### ✅ Milestone 4 — Statistics
- [x] Global stats: `StatsGrid` (countries/cities/trips/km) reused from the dashboard, plus a longest-trip highlight badge
- [x] Km-per-year bar chart (`src/components/stats/YearlyKmChart.tsx`)
- [x] Countries/cities visited, ranked by stops (`src/components/stats/CountryBreakdown.tsx`)
- [x] Per-trip breakdown: date range, city count, km (`src/components/stats/TripBreakdown.tsx`)
- [x] Aggregation helpers in `src/lib/stats.ts` (pure functions over already-fetched `Trip[]`/`Location[]` — no DB-side aggregation needed for a single-user dataset this small)

### ✅ Milestone 5 — Instagram Export
- [x] New page `src/app/trips/[id]/export/page.tsx`: **the whole trip is always drawn** (all markers + full route line + full total km). A checklist of all stops controls only (a) which stops get a permanent **name label** (map + bottom "chain" line + headline = last ticked) and (b) the **"+km added"** figure = the driving legs arriving at each ticked stop, summed. Total km never changes. The full-trip route is calculated **once** (`calculateRoute(locations)` in a `[locations]` effect) — NOT per checkbox — which is what fixed the "stuck calculating route" churn against the public OSRM server; a `.catch`/`routeError` state stops a failed OSRM call hanging the spinner. `MapView.labeledIds` (new prop) labels only the featured markers while still showing every marker. Went through two design iterations from user feedback: "up to stop N" stepper → tick-to-include subset → tick-to-feature-but-keep-whole-trip-visible (current).
- [x] Featured stops get a permanently-visible name tag. Tags render in a dedicated overlay (`div` for tags + `svg` for leader lines) layered above the map canvas, NOT as a child of each marker dot — a greedy placement pass (`layoutLabels` in `MapView.tsx`, re-run on every `render` via a rAF-throttled listener) keeps them on-screen and non-overlapping, trying below/above/right/left at growing distances and drawing a leader line back to the dot when displaced. Marker + label sizes scale with canvas width (`DESIGN_MAP_WIDTH = 1080`) so the full-res export gets big markers/labels while the preview stays proportional (earlier bug: fixed 12px tags looked tiny on the 1080px export and overlapped).
- [x] Last-leg km + running total km, both read from a single `calculateRoute()` call (`src/lib/routing/osrm.ts`'s `legsKm`, parsed from OSRM's existing `route.legs` — no schema change, no second network call)
- [x] Formats: 1080×1350, 1080×1920, 1920×1920, 1080×1080
- [x] Theme: light/dark scrim + a custom accent color for the route line/markers/km badge (`MapView`'s `accentColor` prop). Nav control hidden on the exported map via `showControls={false}`.
- [x] PNG export — captures a dedicated full-resolution off-screen map instance (not the on-screen preview), so the exported PNG is crisp regardless of viewport size. Requires `preserveDrawingBuffer: true` on the MapLibre instance (`MapView.tsx`) — without it, WebGL discards its buffer and the capture can sample a blank frame. **Renderer is `modern-screenshot` (`domToPng`), not html2canvas** — see "Debugging Milestone 5 (round 3)" for why the swap was necessary.

### Debugging Milestone 5 (round 2)
- [x] **Every map lost its markers (dashboard, `/map`, trip detail, export)** — the M5 work added `position:relative` to the marker element's inline `cssText` (to anchor the new name label). That inline style overrode MapLibre's own `.maplibregl-marker { position:absolute }` class (inline beats class), dropping every marker into normal document flow so they piled up / landed off-target. Fixed: removed the inline `position` entirely — the class's `position:absolute` both positions the marker *and* serves as the containing block for the `top:100%` name label.
- [x] **Exported PNG showed only tiles — no markers, no route line, default center/zoom** — the off-screen capture map was captured after a fixed 1200 ms timer that raced the map's network load. When the timer won, the map was still at its default view with `loaded === false`, so the markers/route/fit effect had never run. (The tiles + overlay text *did* capture, proving html2canvas handles both the WebGL canvas and the DOM — only the map data was missing.) Fixed: `MapView` now fires an `onReady` callback on the map's `idle` event after the latest fit paints; `handleExport` awaits that (with an 8 s fallback) before capturing, so the capture always sees the real fitted view. Export map also uses `duration: 0` fit + extra bottom fit-padding so labels clear the text scrim.
- [ ] Still not click-through-verified in a real browser (no browser in the dev environment) — the capture path is sound in logic but the actual PNG download should be eyeballed once.

### Debugging Milestone 5 (round 3) — export polish + renderer swap
- [x] **Switched the export renderer from `html2canvas` to `modern-screenshot` (`domToPng`).** html2canvas reimplements CSS layout and got five separate things wrong, each visible in the exported PNG (but fine in the on-screen preview): (1) `display:flex` centering ignored + width-less flex boxes blown up to full parent width → labels stretched edge-to-edge; (2) `box-shadow` rendered as gray gradient bands; (3) one-sided `border-left` detached from its box; (4) `transform:translate` applied inconsistently to a box vs its border; (5) single-line text baseline rendered too low → circle numbers / pill text / km badge all sat at the bottom of their boxes. `modern-screenshot` captures via an SVG `<foreignObject>`, so **the browser itself lays out and rasterizes the DOM — the export now matches the preview exactly.** It reads the MapLibre WebGL canvas fine (tiles are CORS-clean; `preserveDrawingBuffer:true` still required) and auto-embeds the self-hosted `next/font` Inter files. `html2canvas` dependency removed. The `onReady`/`idle` await + `document.fonts.ready` await + 400 ms settle before capture were kept.
- [x] **Editable per-stop captions.** `export/page.tsx` holds `customLabels: Record<locationId, string>`; each stop row in the sidebar has an inline text input (placeholder = geocoded `loc.name`, ↺ resets). The override flows to the map name-tag (new `MapView`/`MapWrapper` `labelOverrides` prop) and to the bottom headline/chain via a `displayName()` helper. Blank falls back to `loc.name`.
- [x] **Bigger, centered markers + prettier tags.** `DOT_AT_DESIGN` 30→48, `LABEL_FONT_AT_DESIGN` 26→36, headline 76→88 (all `* scale`, so preview stays proportional). Marker number centered via `line-height:${dotSize - 2*borderW}` (content height, NOT border-box height — using the full height leaves the digit low). Tags are clean white pills with an accent border + leader line.
- [x] **Tags avoid covering markers + route.** `layoutLabels` now takes all markers (keep-out circles) and the route (sampled screen points) as obstacles and scores 8 directions × 12 distances per label, picking the least-covering spot (overlap-another-label ≫ cover-marker ≫ cover-route). Obstacle geometry passed as lng/lat and projected fresh each render.
- Note: several `// html2canvas ...` comments in `MapView.tsx` now over-attribute the CSS choices to html2canvas; the choices are still valid under `modern-screenshot` (which renders natively), just no longer *required*. Harmless; not worth the churn to reword.

### Debugging Milestone 5 (round 4) — export broken on iPhone (iOS Safari)
- [x] **Symptom (real device):** exported PNG showed the map at its **default center/zoom** (Belgium-centered, z5), **no markers, no route**, and only a partial vertical map band — the caption/headline/km overlay captured fine. Two stacked iOS-specific root causes:
  1. **Off-screen rАF throttling.** The capture stage was parked at `position:fixed; left:-9999px`. iOS Safari throttles `requestAnimationFrame` for far-off-screen elements, so MapLibre's render loop never finished loading tiles + running the fit-bounds, the `idle`/`onReady` never fired, and the 8 s fallback timer captured a blank, unfitted view. **Fix:** the capture stage is now rendered **on-screen within the viewport**, scaled down to fit via `transform: scale(captureFitScale)` (`transform-origin: top left`), hidden from the user behind an opaque `bg-background` "Rendering image…" overlay (z-50 over the z-40 stage). On-screen ⇒ rAF runs normally ⇒ the map completes its fit and `idle` fires. `modern-screenshot` still outputs full resolution because `domToPng` is passed explicit `width`/`height` — the on-screen transform only shrinks the *preview*, not the captured node (`captureRef` is the un-transformed inner div).
  2. **Over-size WebGL canvas.** A 1080/1920px container × the phone's `devicePixelRatio` (2–3) = a 2160–5760px drawing buffer, past iOS's ~4096px / ~16.7 Mpx WebGL canvas ceiling → partial/clamped render. **Fix:** new `MapView`/`MapWrapper` `pixelRatio` prop (MapLibre v4 constructor option); the capture map passes `pixelRatio={1}` so its buffer equals the already-full-resolution container (≤1920px, huge margin). On-screen preview + all other maps keep the device default.
- [x] **Label measurement switched `getBoundingClientRect().width/height` → `offsetWidth`/`offsetHeight`** in `layoutLabels`' pill sizing (`MapView.tsx`). Under the new `transform: scale()` wrapper, `getBoundingClientRect` returns the *scaled* size while the overlay math works in full 1080/1920-space; `offsetWidth` is transform-agnostic (true layout size). `captionRef` already used `offsetHeight`.
- Also bumped the post-`idle` settle 400 → 600 ms for slower mobile paints. **Not yet device-verified from the dev env (no iOS/browser here)** — reasoned fix, build-clean; the user should re-test the export on the phone.

### ✅ Milestone 6 — PWA + Deployment
- [x] **Full PWA with offline support** — hand-rolled service worker (`public/sw.js`), **not** `next-pwa`/Serwist (the webpack-based plugins are a compatibility risk against Next 16 + Turbopack). Strategies per request type: navigations → network-first w/ `offline.html` fallback; `/_next/static` & `/_next/image` → cache-first (content-hashed, immutable); `tiles.openfreemap.org` map tiles → stale-while-revalidate (capped 300); OSRM + Supabase → network-first w/ cache backup; Nominatim geocoding → bypassed (live typeahead, never stale). Caches versioned via `SW_VERSION`, old caches purged on `activate`. Registered client-side by `src/components/shared/ServiceWorkerRegistration.tsx` (production only — a SW in dev fights Turbopack HMR), mounted in `layout.tsx`.
- [x] **Icons** — generated from `public/icons/icon.svg` (route/pin motif on the indigo→violet accent gradient) via the `sharp` bundled with Next: `icon-192/512`, `icon-maskable-192/512` (content scaled to the maskable safe zone, `icon-maskable.svg`), `apple-touch-icon` (180), `favicon.ico` (16/32/48) + `favicon-16/32`. Regen script was a throwaway (`__gen-icons.mjs`, deleted).
- [x] `offline.html` — self-contained branded fallback (inline CSS/JS, auto-reloads on `online` event). `manifest.webmanifest` refined: `id`/`scope`/`lang`/`categories`, separate `any` vs `maskable` icon entries. `layout.tsx` `metadata.icons` wired.
- [x] Production build verified (`npm run build` — Next 16 Turbopack, TS clean).
- [x] **GitHub push** — repo `github.com/vincentverwee/Waypoint`, branch renamed `master` → `main` (matches convention + Vercel default). Remote `origin` set, M6 committed and pushed.
- [x] **Vercel deploy** — repo imported to Vercel (auto-detected Next.js), `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` env vars set, deployed live. PWA/service worker is production-only, so it only activates on the live Vercel URL, not `localhost` dev.

---

## Key Decisions

- **No auth** — single-user personal app, Supabase used without RLS
- **App Router** — Next.js 14+ App Router for layouts and server components
- **MapLibre over Google Maps** — open source, no API key costs
- **OSRM** — public instance at `router.project-osrm.org` for routing (free, no key)
- **next-themes** — handles dark/light mode SSR safely
- **Mock data fallback** — app renders with sample data when Supabase not configured
