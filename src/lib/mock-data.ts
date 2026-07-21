import { Trip, DashboardStats } from '@/types';

export const MOCK_TRIPS: Trip[] = [
  {
    id: 'mock-1',
    title: 'Summer Roadtrip 2025',
    description: 'Antwerp → Paris → Lyon → Barcelona',
    start_date: '2025-07-01',
    end_date: '2025-07-14',
    cover_image: null,
    route_preference: 'avoid_tolls',
    total_km: 2847,
    created_at: '2025-07-01T00:00:00Z',
    updated_at: '2025-07-14T00:00:00Z',
  },
  {
    id: 'mock-2',
    title: 'Weekend in Amsterdam',
    description: 'Quick city break up north',
    start_date: '2025-05-10',
    end_date: '2025-05-12',
    cover_image: null,
    route_preference: 'allow_tolls',
    total_km: 314,
    created_at: '2025-05-10T00:00:00Z',
    updated_at: '2025-05-12T00:00:00Z',
  },
  {
    id: 'mock-3',
    title: 'Normandy Coast 2024',
    description: 'D-Day beaches and Mont Saint-Michel',
    start_date: '2024-08-05',
    end_date: '2024-08-18',
    cover_image: null,
    route_preference: 'allow_tolls',
    total_km: 3210,
    created_at: '2024-08-05T00:00:00Z',
    updated_at: '2024-08-18T00:00:00Z',
  },
];

export const MOCK_STATS: DashboardStats = {
  countries_visited: 6,
  cities_visited: 18,
  trips_count: 4,
  total_km: 8432,
  longest_trip_km: 3210,
  longest_trip_title: 'Normandy Coast 2024',
  latest_trip: MOCK_TRIPS[0],
};
