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
  route_preference TEXT DEFAULT 'fastest' CHECK (route_preference IN ('fastest', 'avoid_tolls')),
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
  order_index INTEGER NOT NULL,
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

### Milestone 2 — Trip Management (TODO)
- Create/edit/delete trips
- Add/reorder locations with drag-and-drop
- Supabase CRUD connected

### Milestone 3 — Maps & Routing (TODO)
- MapLibre interactive map
- OSRM real driving distances
- Route lines on map
- Toll road preference

### Milestone 4 — Statistics (TODO)
- Per-trip and global stats
- Km per year charts
- Countries/cities visited

### Milestone 5 — Instagram Export (TODO)
- 1080×1350 and 1080×1920 formats
- Canvas/html2canvas export
- Theme customization

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
