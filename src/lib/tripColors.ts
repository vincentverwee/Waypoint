import type { Trip } from '@/types';

// Validated 8-hue categorical palette (dataviz skill reference), in its documented fixed order —
// the order itself is the colorblind-safety mechanism. Adjacent-pair CVD ΔE 9.1 / normal-vision
// ΔE 19.6 on a light surface (scripts/validate_palette.js).
export const TRIP_COLORS = [
  '#2a78d6', // blue
  '#eb6834', // orange
  '#1baf7a', // aqua
  '#eda100', // yellow
  '#e87ba4', // magenta
  '#008300', // green
  '#4a3aa7', // violet
  '#e34948', // red
];

/**
 * Assigns each trip a *distinct* palette color by its position in chronological order — so no two
 * trips share (or nearly share) a hue, which the previous per-id hash did by chance. Ordering by
 * date keeps the assignment stable and puts nearby-in-time trips in adjacent hues. Past 8 trips the
 * palette cycles (a personal single-user map rarely shows that many at once).
 */
export function assignTripColors(trips: Trip[]): Record<string, string> {
  const ordered = [...trips].sort(
    (a, b) =>
      (a.start_date ?? a.created_at).localeCompare(b.start_date ?? b.created_at) ||
      a.id.localeCompare(b.id)
  );
  const colors: Record<string, string> = {};
  ordered.forEach((trip, i) => {
    colors[trip.id] = TRIP_COLORS[i % TRIP_COLORS.length];
  });
  return colors;
}
