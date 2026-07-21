import { MOCK_STATS, MOCK_TRIPS } from './mock-data';
import { DashboardStats, Trip } from '@/types';

function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export async function getDashboardStats(): Promise<DashboardStats> {
  if (!isSupabaseConfigured()) return MOCK_STATS;
  // Real Supabase queries added in Milestone 2
  return MOCK_STATS;
}

export async function getRecentTrips(limit = 5): Promise<Trip[]> {
  if (!isSupabaseConfigured()) return MOCK_TRIPS.slice(0, limit);
  // Real Supabase queries added in Milestone 2
  return MOCK_TRIPS.slice(0, limit);
}
