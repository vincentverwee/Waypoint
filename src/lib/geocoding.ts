export interface GeocodingResult {
  name: string;
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    country?: string;
    country_code?: string;
  };
}

export async function searchPlaces(query: string): Promise<GeocodingResult[]> {
  if (!query || query.length < 2) return [];

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=6&addressdetails=1`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Waypoint/1.0 (travel journal app)',
    },
  });

  if (!res.ok) return [];
  return res.json();
}

export function extractCity(result: GeocodingResult): string {
  return (
    result.address?.city ??
    result.address?.town ??
    result.address?.village ??
    result.display_name.split(',')[0]
  );
}

export function extractCountry(result: GeocodingResult): string {
  return result.address?.country ?? '';
}
