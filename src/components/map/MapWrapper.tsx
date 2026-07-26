'use client';

import dynamic from 'next/dynamic';
import type { Location } from '@/types';

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
  accentColor?: string;
  showLabels?: boolean;
  labeledIds?: string[];
  labelOverrides?: Record<string, string>;
  reserveBottom?: number;
  showControls?: boolean;
  pixelRatio?: number;
  onReady?: () => void;
}

export function MapWrapper({
  className,
  locations,
  routeGeometry,
  routes,
  tripLabels,
  accentColor,
  showLabels,
  labeledIds,
  labelOverrides,
  reserveBottom,
  showControls,
  pixelRatio,
  onReady,
}: MapWrapperProps) {
  return (
    <div className={className}>
      <MapView
        locations={locations}
        routeGeometry={routeGeometry}
        routes={routes}
        tripLabels={tripLabels}
        accentColor={accentColor}
        showLabels={showLabels}
        labeledIds={labeledIds}
        labelOverrides={labelOverrides}
        reserveBottom={reserveBottom}
        showControls={showControls}
        pixelRatio={pixelRatio}
        onReady={onReady}
      />
    </div>
  );
}
