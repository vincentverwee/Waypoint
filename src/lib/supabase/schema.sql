-- ============================================================
-- Waypoint Database Schema
-- Single-user travel tracking application
-- Run this in the Supabase SQL editor (Project Settings → SQL Editor)
-- ============================================================

-- TRIPS table
CREATE TABLE trips (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title            TEXT NOT NULL,
  description      TEXT,
  start_date       DATE,
  end_date         DATE,
  cover_image      TEXT,
  route_preference TEXT NOT NULL DEFAULT 'allow_tolls'
                   CHECK (route_preference IN ('allow_tolls', 'avoid_tolls')),
  total_km         NUMERIC(10, 2),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- LOCATIONS table
CREATE TABLE locations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id        UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  latitude       NUMERIC(10, 7) NOT NULL,
  longitude      NUMERIC(10, 7) NOT NULL,
  country        TEXT,
  city           TEXT,
  arrival_date   DATE,
  departure_date DATE,
  notes          TEXT,
  visit_order    INTEGER NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (trip_id, visit_order)
);

CREATE INDEX idx_locations_trip_id    ON locations(trip_id);
CREATE INDEX idx_locations_trip_order ON locations(trip_id, visit_order);

-- ROUTE_DATA table
CREATE TABLE route_data (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id        UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  distance_km    NUMERIC(10, 2) NOT NULL,
  geometry       JSONB NOT NULL,
  routing_engine TEXT NOT NULL DEFAULT 'osrm'
                 CHECK (routing_engine IN ('osrm', 'graphhopper', 'valhalla')),
  avoid_tolls    BOOLEAN NOT NULL DEFAULT false,
  calculated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_response   JSONB
);

CREATE INDEX idx_route_data_trip_id ON route_data(trip_id);

-- Auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trips_updated_at
  BEFORE UPDATE ON trips
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER locations_updated_at
  BEFORE UPDATE ON locations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
