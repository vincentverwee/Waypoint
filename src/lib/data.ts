import { MOCK_STATS, MOCK_TRIPS, getAllMockLocations } from './mock-data';
import { DashboardStats, Trip, Location } from '@/types';
import { isSupabaseConfigured } from './supabase/config';
import { createServerClient } from './supabase/server';

export async function getDashboardStats(): Promise<DashboardStats> {
  if (!isSupabaseConfigured()) return MOCK_STATS;

  const supabase = createServerClient();
  const [{ data: trips, error: tripsError }, { data: locations, error: locationsError }] =
    await Promise.all([
      supabase.from('trips').select('*'),
      supabase.from('locations').select('country, city'),
    ]);
  if (tripsError) throw tripsError;
  if (locationsError) throw locationsError;

  const tripList = (trips ?? []) as Trip[];
  const countries = new Set((locations ?? []).map((l) => l.country).filter(Boolean));
  const cities = new Set((locations ?? []).map((l) => l.city).filter(Boolean));
  const totalKm = tripList.reduce((sum, t) => sum + (t.total_km ?? 0), 0);

  const longestTrip = tripList.reduce<Trip | null>((longest, t) => {
    if (!t.total_km) return longest;
    if (!longest || t.total_km > (longest.total_km ?? 0)) return t;
    return longest;
  }, null);

  const latestTrip = tripList.reduce<Trip | null>((latest, t) => {
    if (!t.start_date) return latest;
    if (!latest || !latest.start_date || t.start_date > latest.start_date) return t;
    return latest;
  }, null);

  return {
    countries_visited: countries.size,
    cities_visited: cities.size,
    trips_count: tripList.length,
    total_km: totalKm,
    longest_trip_km: longestTrip?.total_km ?? 0,
    longest_trip_title: longestTrip?.title ?? null,
    latest_trip: latestTrip,
  };
}

export async function getRecentTrips(limit = 5): Promise<Trip[]> {
  if (!isSupabaseConfigured()) return MOCK_TRIPS.slice(0, limit);

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .order('start_date', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw error;
  return data as Trip[];
}

export async function getAllTrips(): Promise<Trip[]> {
  if (!isSupabaseConfigured()) return MOCK_TRIPS;

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .order('start_date', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return data as Trip[];
}

export async function getAllLocations(): Promise<Location[]> {
  if (!isSupabaseConfigured()) return getAllMockLocations();

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .order('trip_id')
    .order('visit_order');
  if (error) throw error;
  return data as Location[];
}
