import { Trip, Location } from '@/types';

export interface YearlyStats {
  year: number;
  totalKm: number;
  tripsCount: number;
}

export function getYearlyStats(trips: Trip[]): YearlyStats[] {
  const byYear = new Map<number, YearlyStats>();

  for (const trip of trips) {
    if (!trip.start_date) continue;
    const year = new Date(trip.start_date).getFullYear();
    const entry = byYear.get(year) ?? { year, totalKm: 0, tripsCount: 0 };
    entry.totalKm += trip.total_km ?? 0;
    entry.tripsCount += 1;
    byYear.set(year, entry);
  }

  return [...byYear.values()].sort((a, b) => a.year - b.year);
}

export interface CountryStats {
  country: string;
  cities: number;
  visits: number;
}

export function getCountryStats(locations: Location[]): CountryStats[] {
  const byCountry = new Map<string, { cities: Set<string>; visits: number }>();

  for (const loc of locations) {
    if (!loc.country) continue;
    const entry = byCountry.get(loc.country) ?? { cities: new Set<string>(), visits: 0 };
    if (loc.city) entry.cities.add(loc.city);
    entry.visits += 1;
    byCountry.set(loc.country, entry);
  }

  return [...byCountry.entries()]
    .map(([country, { cities, visits }]) => ({ country, cities: cities.size, visits }))
    .sort((a, b) => b.visits - a.visits);
}

export interface TripBreakdownEntry {
  trip: Trip;
  cityCount: number;
}

export function getTripBreakdown(trips: Trip[], locations: Location[]): TripBreakdownEntry[] {
  return trips
    .map((trip) => {
      const cities = new Set(
        locations
          .filter((loc) => loc.trip_id === trip.id)
          .map((loc) => loc.city)
          .filter((city): city is string => Boolean(city))
      );
      return { trip, cityCount: cities.size };
    })
    .sort((a, b) => (b.trip.start_date ?? '').localeCompare(a.trip.start_date ?? ''));
}
