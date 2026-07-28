'use client';

import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import type { Location } from '@/types';
import { cn } from '@/lib/utils';
import { colorForTrip } from '@/lib/tripColors';
import { TripLegend, type LegendChip } from './TripLegend';

const MapView = dynamic(() => import('./MapView'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded-2xl bg-muted" />,
});

interface MapWrapperProps {
  className?: string;
  locations?: Location[];
  routeGeometry?: GeoJSON.LineString | null;
  routes?: { tripId: string; geometry: GeoJSON.LineString }[];
  tripLabels?: Record<string, string>;
  tripColors?: Record<string, string>;
  markerStyle?: 'numbered' | 'dot' | 'none';
  accentColor?: string;
  showLabels?: boolean;
  labeledIds?: string[];
  labelOverrides?: Record<string, string>;
  reserveBottom?: number;
  showControls?: boolean;
  pixelRatio?: number;
  onReady?: () => void;
  /** Multi-trip maps (dashboard, world map): show the trip-focus legend + enable tap-to-focus. */
  selectable?: boolean;
}

export function MapWrapper({
  className,
  locations,
  routeGeometry,
  routes,
  tripLabels,
  tripColors,
  markerStyle,
  accentColor,
  showLabels,
  labeledIds,
  labelOverrides,
  reserveBottom,
  showControls,
  pixelRatio,
  onReady,
  selectable = false,
}: MapWrapperProps) {
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);

  // Legend chips: one per trip that actually has a route drawn, in the order the routes arrive
  // (pages sort them chronologically). Label from tripLabels, color from tripColors (fallback hash).
  const chips = useMemo<LegendChip[]>(() => {
    if (!selectable || !routes?.length) return [];
    const seen = new Set<string>();
    const out: LegendChip[] = [];
    for (const r of routes) {
      if (seen.has(r.tripId)) continue;
      seen.add(r.tripId);
      out.push({
        id: r.tripId,
        label: tripLabels?.[r.tripId] ?? 'Trip',
        color: tripColors?.[r.tripId] ?? colorForTrip(r.tripId),
      });
    }
    return out;
  }, [selectable, routes, tripLabels, tripColors]);

  const showLegend = selectable && chips.length > 0;

  const map = (
    <MapView
      locations={locations}
      routeGeometry={routeGeometry}
      routes={routes}
      tripLabels={tripLabels}
      tripColors={tripColors}
      markerStyle={markerStyle}
      accentColor={accentColor}
      showLabels={showLabels}
      labeledIds={labeledIds}
      labelOverrides={labelOverrides}
      reserveBottom={reserveBottom}
      showControls={showControls}
      pixelRatio={pixelRatio}
      onReady={onReady}
      selectedTripId={showLegend ? selectedTripId : null}
      onSelectTrip={showLegend ? setSelectedTripId : undefined}
    />
  );

  if (!showLegend) {
    return <div className={className}>{map}</div>;
  }

  // Legend on top (shrink-0), map fills the rest.
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <TripLegend chips={chips} selectedId={selectedTripId} onSelect={setSelectedTripId} />
      <div className="min-h-0 flex-1">{map}</div>
    </div>
  );
}
