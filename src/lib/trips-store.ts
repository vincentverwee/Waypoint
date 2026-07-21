import { Trip, Location } from '@/types';
import { MOCK_TRIPS } from './mock-data';

export type CreateTripInput = {
  title: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  route_preference: 'allow_tolls' | 'avoid_tolls';
};

export type UpdateTripInput = Partial<CreateTripInput>;

export type CreateLocationInput = {
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  city?: string;
  arrival_date?: string;
  departure_date?: string;
  notes?: string;
};

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function now() {
  return new Date().toISOString();
}

// --- Trip CRUD ---

export async function createTrip(input: CreateTripInput): Promise<Trip> {
  const trip: Trip = {
    id: generateId(),
    title: input.title,
    description: input.description ?? null,
    start_date: input.start_date ?? null,
    end_date: input.end_date ?? null,
    cover_image: null,
    route_preference: input.route_preference,
    total_km: null,
    created_at: now(),
    updated_at: now(),
  };
  return trip;
}

export async function updateTrip(id: string, input: UpdateTripInput): Promise<Trip> {
  const base = MOCK_TRIPS.find((t) => t.id === id) ?? MOCK_TRIPS[0];
  return {
    ...base,
    ...input,
    id,
    updated_at: now(),
  };
}

export async function deleteTrip(id: string): Promise<void> {
  // No-op in mock mode; Supabase will cascade-delete locations
  void id;
}

export async function getTripWithLocations(
  id: string
): Promise<{ trip: Trip; locations: Location[] }> {
  const trip = MOCK_TRIPS.find((t) => t.id === id) ?? MOCK_TRIPS[0];
  const locations: Location[] = [
    {
      id: 'loc-1',
      trip_id: id,
      name: 'Antwerp, Belgium',
      latitude: 51.2194,
      longitude: 4.4025,
      country: 'Belgium',
      city: 'Antwerp',
      arrival_date: '2025-07-01',
      departure_date: '2025-07-01',
      notes: 'Starting point',
      visit_order: 0,
      created_at: now(),
      updated_at: now(),
    },
    {
      id: 'loc-2',
      trip_id: id,
      name: 'Paris, France',
      latitude: 48.8566,
      longitude: 2.3522,
      country: 'France',
      city: 'Paris',
      arrival_date: '2025-07-02',
      departure_date: '2025-07-04',
      notes: null,
      visit_order: 1,
      created_at: now(),
      updated_at: now(),
    },
    {
      id: 'loc-3',
      trip_id: id,
      name: 'Barcelona, Spain',
      latitude: 41.3851,
      longitude: 2.1734,
      country: 'Spain',
      city: 'Barcelona',
      arrival_date: '2025-07-08',
      departure_date: '2025-07-12',
      notes: null,
      visit_order: 2,
      created_at: now(),
      updated_at: now(),
    },
  ];

  if (id === 'mock-2') {
    return {
      trip,
      locations: [
        {
          id: 'loc-4',
          trip_id: id,
          name: 'Antwerp, Belgium',
          latitude: 51.2194,
          longitude: 4.4025,
          country: 'Belgium',
          city: 'Antwerp',
          arrival_date: '2025-05-10',
          departure_date: '2025-05-10',
          notes: null,
          visit_order: 0,
          created_at: now(),
          updated_at: now(),
        },
        {
          id: 'loc-5',
          trip_id: id,
          name: 'Amsterdam, Netherlands',
          latitude: 52.3676,
          longitude: 4.9041,
          country: 'Netherlands',
          city: 'Amsterdam',
          arrival_date: '2025-05-10',
          departure_date: '2025-05-12',
          notes: null,
          visit_order: 1,
          created_at: now(),
          updated_at: now(),
        },
      ],
    };
  }

  return { trip, locations };
}
