-- Waypoint database schema
-- Paste into the Supabase SQL Editor (Project -> SQL Editor -> New query) and run once.
-- Column names/values match src/types/index.ts exactly (visit_order, allow_tolls/avoid_tolls).

create extension if not exists "pgcrypto";

create table if not exists trips (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  start_date date,
  end_date date,
  cover_image text,
  total_km decimal(10,2),
  route_preference text not null default 'allow_tolls' check (route_preference in ('allow_tolls', 'avoid_tolls')),
  route_geometry jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Run this if you already created the `trips` table before route_geometry was added:
-- alter table trips add column if not exists route_geometry jsonb;

create table if not exists locations (
  id uuid default gen_random_uuid() primary key,
  trip_id uuid not null references trips(id) on delete cascade,
  name text not null,
  latitude decimal(10,7) not null,
  longitude decimal(10,7) not null,
  country text,
  city text,
  arrival_date date,
  departure_date date,
  notes text,
  visit_order integer not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists locations_trip_id_idx on locations(trip_id);
create index if not exists locations_trip_id_visit_order_idx on locations(trip_id, visit_order);

create table if not exists route_segments (
  id uuid default gen_random_uuid() primary key,
  trip_id uuid not null references trips(id) on delete cascade,
  from_location_id uuid not null references locations(id) on delete cascade,
  to_location_id uuid not null references locations(id) on delete cascade,
  distance_km decimal(10,2),
  route_geometry jsonb,
  avoid_tolls boolean default false,
  calculated_at timestamptz default now()
);

create index if not exists route_segments_trip_id_idx on route_segments(trip_id);

-- No RLS: single-user personal app, accessed only via the publishable/anon key.
-- Do not enable RLS unless you also add policies -- an empty RLS-enabled table blocks all access.
