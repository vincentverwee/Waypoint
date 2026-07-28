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
- Also bumped the post-`idle` settle 400 → 600 ms for slower mobile paints.
- ⚠️ **This round did NOT fix it** (still blank/unfitted, no markers/route on iPhone, and it regressed desktop). Superseded by round 5 — the `pixelRatio` prop + `offsetWidth` measurement changes were kept, but the on-screen-scaled *separate capture map* was removed.

### Debugging Milestone 5 (round 5) — stop racing a hidden capture map; capture the preview
- [x] **Root cause was architectural, not timing.** Every prior round spun up a **second, hidden, full-resolution MapLibre instance** on export and raced its cold load (style → tiles → `load` → marker/route/fit effect → `idle`). That race is what kept producing a blank, unfitted map with no markers/route — reliably on iOS, intermittently elsewhere. No amount of await/settle tuning fixed it robustly.
- [x] **Fix: capture the on-screen preview itself.** The right-panel preview map is already mounted, loaded, fitted, and showing markers/route/labels — it *works*. `handleExport` captures `previewRef` via `domToPng`. **WYSIWYG — the export always matches the preview**, no second map, no cold-load race, no off-screen/iOS compositing issue. Removed: the hidden capture `ExportStage`, the `left:-9999`/scaled-wrapper + covering overlay, `captureRef`/`readyResolveRef`/`handleCaptureReady`/`onReady`-await, `EXPORT_READY_TIMEOUT_MS`.
- [x] **Refinement (look):** the first cut rendered the preview map small (~380px) and **upscaled** it in `domToPng` (`scale = format.width/previewWidth`). That looked bad — MapLibre draws sparse, oversized city labels + a giant attribution bar at small CSS sizes, and the 3× upscale blurred tiles and thickened the route line. **Now the preview renders the stage at the FULL export resolution** (`ExportStage width={format.width}`, `pixelRatio={1}`) and is only *displayed* shrunk to fit the panel via a `transform: scale(previewWidth/format.width)` on an **ancestor** (`previewRef` itself has no transform). `handleExport` then captures 1:1 (`width/height = format`, `scale: 1`). Result = MapLibre's native dense detail / small labels / thin line / normal attribution, crisp. WebGL buffer = `format.width × 1` (≤1920), safely under the iOS limit that blew up the *original* full-res map (which used device DPR → ~5760px). `backgroundColor` fills the stage's tiny rounded corners.
- Why the ancestor-transform trick is safe for capture: `modern-screenshot` clones from `previewRef` **down** (ignoring ancestors) and honors the explicit `width`/`height`, so the on-screen shrink never scales the output. Label pill sizing uses `offsetWidth`/`offsetHeight` (transform-agnostic) so it's measured in true 1080/1920-space.
- Kept from round 4 (still valid): `MapView`/`MapWrapper` `pixelRatio` prop (MapLibre v4 constructor option). **Still not device-verified from the dev env (no iOS/browser here).**

### ✅ Milestone 6 — PWA + Deployment
- [x] **Full PWA with offline support** — hand-rolled service worker (`public/sw.js`), **not** `next-pwa`/Serwist (the webpack-based plugins are a compatibility risk against Next 16 + Turbopack). Strategies per request type: navigations → network-first w/ `offline.html` fallback; `/_next/static` & `/_next/image` → cache-first (content-hashed, immutable); `tiles.openfreemap.org` map tiles → stale-while-revalidate (capped 300); OSRM + Supabase → network-first w/ cache backup; Nominatim geocoding → bypassed (live typeahead, never stale). Caches versioned via `SW_VERSION`, old caches purged on `activate`. Registered client-side by `src/components/shared/ServiceWorkerRegistration.tsx` (production only — a SW in dev fights Turbopack HMR), mounted in `layout.tsx`.
- [x] **Icons** — generated from `public/icons/icon.svg` (route/pin motif on the indigo→violet accent gradient) via the `sharp` bundled with Next: `icon-192/512`, `icon-maskable-192/512` (content scaled to the maskable safe zone, `icon-maskable.svg`), `apple-touch-icon` (180), `favicon.ico` (16/32/48) + `favicon-16/32`. Regen script was a throwaway (`__gen-icons.mjs`, deleted).
- [x] `offline.html` — self-contained branded fallback (inline CSS/JS, auto-reloads on `online` event). `manifest.webmanifest` refined: `id`/`scope`/`lang`/`categories`, separate `any` vs `maskable` icon entries. `layout.tsx` `metadata.icons` wired.
- [x] Production build verified (`npm run build` — Next 16 Turbopack, TS clean).
- [x] **GitHub push** — repo `github.com/vincentverwee/Waypoint`, branch renamed `master` → `main` (matches convention + Vercel default). Remote `origin` set, M6 committed and pushed.
- [x] **Vercel deploy** — repo imported to Vercel (auto-detected Next.js), `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` env vars set, deployed live. PWA/service worker is production-only, so it only activates on the live Vercel URL, not `localhost` dev.


### Post-M6 — Map colors, dashboard map & export UX polish

A run of small iterative changes after deploy (all on `main`, live on Vercel):

**Export UX (`src/app/trips/[id]/export/page.tsx`)**
- [x] Stop checklist **defaults to none checked** — the whole trip always draws; you opt *in* to which stops get a label/caption/"+km" (`setIncluded(new Set())` on load). With nothing checked the caption falls back to the trip title.
- [x] Checklist is displayed **latest-stop-first** (reversed) — the number badge on each row still shows the true visit order (`{ loc, num: i+1 }` mapped, then `.reverse()`), so only the list order flipped, not the numbering or any downstream index (legs, day numbers).
- [x] **Per-trip Export button on the dashboard** — each row of `RecentTrips` (dashboard) has an `ImageDown` icon-button linking to `/trips/[id]/export`, so any trip exports in one tap from the dashboard (mirrors the Export button on the trip detail page). Removed the row's misleading `cursor-pointer` (it never navigated).

**Per-trip colors (`src/lib/tripColors.ts`)**
- [x] `TRIP_COLORS` = the validated **8-hue categorical palette** (dataviz skill reference), in its documented fixed order — the order is the colorblind-safety mechanism (adjacent-pair CVD ΔE 9.1 / normal-vision ΔE 19.6 on a light surface; `scripts/validate_palette.js`). Replaces the old 6 ad-hoc hexes.
- [x] `assignTripColors(trips)` gives each trip a **distinct** hue by chronological order (`start_date ?? created_at`), so no two trips collide — the old per-id **hash** (`colorForTrip`) chanced collisions ("multiple blues"). The dashboard and `/map` pass the resulting `tripColors` map to `MapWrapper`; `colorForTrip` (now over `TRIP_COLORS`) stays only as the fallback when no map is supplied. In `MapView` a single `resolveColor(tripId)` (`accentColor ?? tripColors?.[id] ?? colorForTrip(id)`) feeds markers, dots **and** route lines so they always match.
- Note: the user asked about "same year → same colour, different shade" grouping; **rejected** because most trips are the same year (2026), so year-grouping would collapse them to one hue — the opposite of the goal. Distinct-per-trip is the intentional choice.

**Stop markers (`MapView`/`MapWrapper` `markerStyle` prop: `'numbered' | 'dot' | 'none'`, default `'numbered'`)**
- [x] Dashboard's combined multi-trip map was cluttered by overlapping **numbered pins** from every trip. Dashboard now passes `markerStyle="dot"` → small trip-colored **dots** drawn as a MapLibre **circle layer** (`DOTS_*`, `circle-radius` zoom-interpolated 3→5.5, white stroke), not DOM markers. Single-trip views + exports keep `'numbered'` DOM pins. `'none'` = nothing.

**Overlapping routes — the rendering saga (`MapView.tsx`)** — kept every trip's color visible where routes share a road, without moving lines off the road. Iterations (each reverted on user feedback), ending at the current approach:
1. ~~Per-route perpendicular `line-offset`~~ → **warped**: a constant *pixel* offset drifts lines off the road (huge at low zoom, hugging in as you zoom), plus corner artifacts on simplified geometry.
2. ~~Nested widths~~ (each trip a different line width so shared roads show concentric colored bands, all centered) → **looked horrible** (fat base line, uneven thicknesses).
3. ~~Dashes only where routes overlap~~ (two layers: a dashed base of every full route whose out-of-phase dashes interleaved on shared roads, + a solid top of each route's solo runs from `computeSoloSegments()`). Worked but dashes read as "planned/uncertain" for a *history*, shrank to noise at overview zoom, and on heavy overlap the topmost opaque trip still dominated. **Removed.**
4. **Current — shared-corridor segment graph + tap-to-focus** (mobile-first redesign). No offsets, no dashes.
   - **Data model** (`src/lib/routing/corridors.ts`, pure/testable): `buildCorridorSegments(routes)` snaps every vertex to a grid (`TAU ≈ 0.0006°` → canonical node), builds undirected edges tagged with the trips that traverse them, then walks each route grouping consecutive edges with an *identical trip-set* into one `CorridorSegment { geometry, trips[], shared }`. Shared runs are **deduped** (emitted once, not once per sharing trip) — so every distinct piece of road is exactly one segment. This is what kills the "topmost dominates" problem: overlaps are a single entity, not a stack.
   - **Rendering** (`MapView.tsx`, source `corridor`, layers bottom→top): **casing** (white outline, all segments) → **base stroke** (`['get','color']`) → **highlight** (`filter sel==1`, selected trip on top). `line-width` = `['*', ['get','widthMul'], <zoom curve 3→2 … 14→6>]` so widths interpolate with zoom (overview thin, detail thick) and selection scales via `widthMul`. Casing = stroke + 3px.
   - **Default view**: solo segment → its trip color; shared corridor → one neutral **graphite** (`#5b6470`) stroke ("several trips travel here"). **Selected** (`selectedTripId`): that trip's segments — *including* the shared corridors it belongs to — go full color, `widthMul 1.5`, on top; everything else dims to `#aeb6c2`/low opacity; non-focused dots + numbered pins dim too. Selection recolors **in place** via `paintSelection()` (a `setData`, kept out of the marker-building effect's deps) so focusing never rebuilds/flickers the pins.
   - **Interaction** (mobile-first, no hover): `TripLegend` chip strip (`src/components/map/TripLegend.tsx`) is the primary selector — big touch targets, horizontal scroll, "All trips" clears. Tapping a route/dot on the map also selects (one global `click` → `queryRenderedFeatures` on the corridor/dot layers; shared corridor keeps the current selection if it's a member, else focuses the first trip); tapping empty map clears. `MapWrapper` is now **stateful** — holds `selectedTripId`, renders the legend when `selectable` + `routes` are set, wires `selectedTripId`/`onSelectTrip` into `MapView`. Dashboard + `/map` pass `selectable`.
   - Single-trip views / exports (`routeGeometry`) are **unchanged** — one solid line at 0.9 opacity, no corridor layers, no selection (`onSelectTrip` absent ⇒ non-interactive). `colorForTrip` moved to `tripColors.ts` (was exported from the client-only `MapView`) so `MapWrapper` can use the fallback without statically importing `maplibre-gl` into SSR.
   - Not yet device-verified in a real browser (no browser in the dev env); build + `tsc` clean.

---

## Key Decisions

- **No auth** — single-user personal app, Supabase used without RLS
- **App Router** — Next.js 14+ App Router for layouts and server components
- **MapLibre over Google Maps** — open source, no API key costs
- **OSRM** — public instance at `router.project-osrm.org` for routing (free, no key)
- **next-themes** — handles dark/light mode SSR safely
- **Mock data fallback** — app renders with sample data when Supabase not configured
