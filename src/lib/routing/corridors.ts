/**
 * Corridor segmentation — the data model behind the multi-trip route rendering.
 *
 * Instead of drawing N independent polylines (which forces either lane offsets, which warp off the
 * road, or dash interleaving, where the topmost trip dominates), we split each route into runs that
 * are either SOLO (this trip travels the road alone) or SHARED (another trip travels it too). Solo
 * runs draw in the trip color; shared runs draw as one neutral "corridor". Overlapping shared runs
 * from different trips simply paint the same neutral color over each other — no stacking conflict.
 *
 * Continuity matters: the runs are cut on the shared/solo boundary *inclusively* (the boundary
 * vertex belongs to BOTH the run before and the run after) and every original vertex is kept, so
 * the drawn line has no gaps — the earlier grid-decimated version left dash-like holes.
 *
 * Algorithm (pure, O(total vertices × 9)):
 *   1. Hash every vertex of every route into a grid cell → cell → set of trip ids present.
 *   2. A vertex of trip T is "shared" if any of its 3×3 neighbouring cells holds a vertex of some
 *      OTHER trip.
 *   3. Walk each route, grouping consecutive vertices with the same shared-flag into a segment,
 *      splitting (boundary-inclusive) wherever the flag flips.
 */

export interface TripRoute {
  tripId: string;
  geometry: GeoJSON.LineString;
}

export interface CorridorSegment {
  geometry: GeoJSON.LineString;
  /** The trip this run belongs to (single element — kept as an array for the caller's API). */
  trips: string[];
  /** true when another trip also travels this run of road. */
  shared: boolean;
}

// Grid cell in degrees (~45–65 m at mid-latitudes). Two vertices in the same/neighbouring cell are
// treated as "the same road" for deciding whether a run is shared.
const TAU = 0.0006;

const cellX = (lng: number) => Math.floor(lng / TAU);
const cellY = (lat: number) => Math.floor(lat / TAU);

export function buildCorridorSegments(routes: TripRoute[]): CorridorSegment[] {
  if (!routes.length) return [];

  // Pass 1 — which trips have a vertex in each grid cell.
  const cellTrips = new Map<string, Set<string>>();
  for (const route of routes) {
    for (const [lng, lat] of route.geometry.coordinates) {
      const k = `${cellX(lng)}:${cellY(lat)}`;
      let set = cellTrips.get(k);
      if (!set) cellTrips.set(k, (set = new Set()));
      set.add(route.tripId);
    }
  }

  const isShared = (lng: number, lat: number, tripId: string) => {
    const cx = cellX(lng);
    const cy = cellY(lat);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const set = cellTrips.get(`${cx + dx}:${cy + dy}`);
        if (set) for (const other of set) if (other !== tripId) return true;
      }
    }
    return false;
  };

  const segments: CorridorSegment[] = [];

  for (const route of routes) {
    const coords = route.geometry.coordinates;
    if (coords.length < 2) continue;

    const flags = coords.map(([lng, lat]) => isShared(lng, lat, route.tripId));

    let runStart = 0;
    const pushRun = (endInclusive: number, shared: boolean) => {
      // slice end is exclusive, so +1 to include the boundary vertex in this run too.
      const slice = coords.slice(runStart, endInclusive + 1);
      if (slice.length >= 2) {
        segments.push({
          geometry: { type: 'LineString', coordinates: slice },
          trips: [route.tripId],
          shared,
        });
      }
    };

    for (let i = 1; i < coords.length; i++) {
      if (flags[i] !== flags[i - 1]) {
        pushRun(i, flags[i - 1]); // run [runStart .. i] — boundary vertex i shared with next run
        runStart = i;
      }
    }
    pushRun(coords.length - 1, flags[coords.length - 1]);
  }

  return segments;
}
