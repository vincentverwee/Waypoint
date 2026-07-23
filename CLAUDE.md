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

### Milestone 5 — Instagram Export (TODO)
- 1080×1350 and 1080×1920 formats and 1920x1920/1080x1080
- Canvas/html2canvas export
- Theme customization
- I need to be able to see on the rectangle picture for instagram how much kilometers the next stop is, for example: paris -> lyon (x km) then the next day i post a new post with now paris -> lyon -> antibes (y km) with km between lyon and antibes and also the total km for that trip

### Milestone 6 — PWA + Deployment (TODO)
- Full PWA with offline support
- GitHub push
- Vercel deploy

---

## Key Decisions

- **No auth** — single-user personal app, Supabase used without RLS
- **App Router** — Next.js 14+ App Router for layouts and server components
- **MapLibre over Google Maps** — open source, no API key costs
- **OSRM** — public instance at `router.project-osrm.org` for routing (free, no key)
- **next-themes** — handles dark/light mode SSR safely
- **Mock data fallback** — app renders with sample data when Supabase not configured
