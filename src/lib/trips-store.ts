import { Trip, Location } from '@/types';
import { MOCK_TRIPS, MOCK_LOCATIONS, getAllMockLocations } from './mock-data';
import { isSupabaseConfigured } from './supabase/config';
import { createBrowserClient } from './supabase/client';

export type CreateTripInput = {
  title: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  route_preference: 'allow_tolls' | 'avoid_tolls';
};

export type UpdateTripInput = Partial<CreateTripInput>;

export type CreateLocationInput = Omit<Location, 'id' | 'created_at' | 'updated_at'>;
export type UpdateLocationInput = Partial<
  Pick<Location, 'arrival_date' | 'departure_date' | 'notes' | 'visit_order'>
>;
export type UpdateTripRouteInput = { total_km: number; route_geometry: GeoJSON.LineString };

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function now() {
  return new Date().toISOString();
}

/** Postgres `date` columns reject "" (only accept a real date or null) — the trip form leaves cleared fields as "". */
function emptyToNull(value: string | undefined): string | null {
  return value ? value : null;
}

// --- Trip CRUD ---

export async function getTrips(): Promise<Trip[]> {
  if (!isSupabaseConfigured()) return MOCK_TRIPS;

  const supabase = createBrowserClient();
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .order('start_date', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return data as Trip[];
}

export async function createTrip(input: CreateTripInput): Promise<Trip> {
  const description = emptyToNull(input.description);
  const start_date = emptyToNull(input.start_date);
  const end_date = emptyToNull(input.end_date);

  if (!isSupabaseConfigured()) {
    return {
      id: generateId(),
      title: input.title,
      description,
      start_date,
      end_date,
      cover_image: null,
      route_preference: input.route_preference,
      total_km: null,
      route_geometry: null,
      created_at: now(),
      updated_at: now(),
    };
  }

  const supabase = createBrowserClient();
  const { data, error } = await supabase
    .from('trips')
    .insert({
      title: input.title,
      description,
      start_date,
      end_date,
      route_preference: input.route_preference,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Trip;
}

export async function updateTrip(id: string, input: UpdateTripInput): Promise<Trip> {
  const sanitized = {
    ...input,
    ...(input.description !== undefined && { description: emptyToNull(input.description) }),
    ...(input.start_date !== undefined && { start_date: emptyToNull(input.start_date) }),
    ...(input.end_date !== undefined && { end_date: emptyToNull(input.end_date) }),
  };

  if (!isSupabaseConfigured()) {
    const base = MOCK_TRIPS.find((t) => t.id === id) ?? MOCK_TRIPS[0];
    return { ...base, ...sanitized, id, updated_at: now() };
  }

  const supabase = createBrowserClient();
  const { data, error } = await supabase
    .from('trips')
    .update({ ...sanitized, updated_at: now() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Trip;
}

export async function deleteTrip(id: string): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const supabase = createBrowserClient();
  const { error } = await supabase.from('trips').delete().eq('id', id);
  if (error) throw error;
}

export async function getTripWithLocations(
  id: string
): Promise<{ trip: Trip; locations: Location[] }> {
  if (!isSupabaseConfigured()) {
    const trip = MOCK_TRIPS.find((t) => t.id === id) ?? MOCK_TRIPS[0];
    const locations = MOCK_LOCATIONS[id] ?? MOCK_LOCATIONS['mock-1'];
    return { trip, locations };
  }

  const supabase = createBrowserClient();
  const [{ data: trip, error: tripError }, { data: locations, error: locError }] =
    await Promise.all([
      supabase.from('trips').select('*').eq('id', id).single(),
      supabase.from('locations').select('*').eq('trip_id', id).order('visit_order'),
    ]);
  if (tripError) throw tripError;
  if (locError) throw locError;
  return { trip: trip as Trip, locations: locations as Location[] };
}

/** Persists the recalculated total distance and route line for a trip. Mock mode is a no-op. */
export async function updateTripRoute(id: string, input: UpdateTripRouteInput): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const supabase = createBrowserClient();
  const { error } = await supabase.from('trips').update(input).eq('id', id);
  if (error) throw error;
}

// --- Location CRUD ---

export async function getAllLocations(): Promise<Location[]> {
  if (!isSupabaseConfigured()) return getAllMockLocations();

  const supabase = createBrowserClient();
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .order('trip_id')
    .order('visit_order');
  if (error) throw error;
  return data as Location[];
}

export async function createLocation(input: CreateLocationInput): Promise<Location> {
  if (!isSupabaseConfigured()) {
    return { ...input, id: generateId(), created_at: now(), updated_at: now() };
  }

  const supabase = createBrowserClient();
  const { data, error } = await supabase.from('locations').insert(input).select().single();
  if (error) throw error;
  return data as Location;
}

export async function deleteLocation(id: string): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const supabase = createBrowserClient();
  const { error } = await supabase.from('locations').delete().eq('id', id);
  if (error) throw error;
}

export async function updateLocation(id: string, input: UpdateLocationInput): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const supabase = createBrowserClient();
  const { error } = await supabase
    .from('locations')
    .update({ ...input, updated_at: now() })
    .eq('id', id);
  if (error) throw error;
}

/** Persists the full visit order for a trip after a reorder or removal. */
export async function reorderLocations(
  locations: Pick<Location, 'id' | 'visit_order'>[]
): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const supabase = createBrowserClient();
  await Promise.all(
    locations.map(({ id, visit_order }) =>
      supabase.from('locations').update({ visit_order }).eq('id', id)
    )
  );
}
