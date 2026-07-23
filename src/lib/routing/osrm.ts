const OSRM_BASE_URL = 'https://router.project-osrm.org';

export interface RoutePoint {
  latitude: number;
  longitude: number;
}

export interface RouteResult {
  distanceKm: number;
  geometry: GeoJSON.LineString;
}

/**
 * Calculates the real driving route through an ordered list of points using the
 * public OSRM demo server. Its default car profile has no toll/motorway class data
 * compiled in (exclude=toll and exclude=motorway both 400), so route_preference
 * cannot actually influence the path here — it's stored for display only until a
 * routing backend with toll data (GraphHopper/Valhalla) replaces this.
 */
export async function calculateRoute(points: RoutePoint[]): Promise<RouteResult | null> {
  if (points.length < 2) return null;

  const coords = points.map((p) => `${p.longitude},${p.latitude}`).join(';');
  const url = `${OSRM_BASE_URL}/route/v1/driving/${coords}?overview=full&geometries=geojson`;

  const res = await fetch(url);
  if (!res.ok) return null;

  const data = await res.json();
  if (data.code !== 'Ok' || !data.routes?.length) return null;

  const route = data.routes[0];
  return {
    distanceKm: Math.round((route.distance / 1000) * 10) / 10,
    geometry: route.geometry as GeoJSON.LineString,
  };
}
