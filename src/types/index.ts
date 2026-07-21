export type RoutePreference = 'allow_tolls' | 'avoid_tolls';
export type RoutingEngine = 'osrm' | 'graphhopper' | 'valhalla';

export interface Trip {
  id: string;
  title: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  cover_image: string | null;
  route_preference: RoutePreference;
  total_km: number | null;
  created_at: string;
  updated_at: string;
}

export interface Location {
  id: string;
  trip_id: string;
  name: string;
  latitude: number;
  longitude: number;
  country: string | null;
  city: string | null;
  arrival_date: string | null;
  departure_date: string | null;
  notes: string | null;
  visit_order: number;
  created_at: string;
  updated_at: string;
}

export interface RouteData {
  id: string;
  trip_id: string;
  distance_km: number;
  geometry: object;
  routing_engine: RoutingEngine;
  avoid_tolls: boolean;
  calculated_at: string;
  raw_response: unknown;
}

export interface DashboardStats {
  countries_visited: number;
  cities_visited: number;
  trips_count: number;
  total_km: number;
  longest_trip_km: number;
  longest_trip_title: string | null;
  latest_trip: Trip | null;
}
