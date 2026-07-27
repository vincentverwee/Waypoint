import { AppShell } from '@/components/layout/AppShell';
import { MapWrapper } from '@/components/map/MapWrapper';
import { getAllLocations, getAllTrips } from '@/lib/data';
import { assignTripColors } from '@/lib/tripColors';

export const dynamic = 'force-dynamic';

export default async function MapPage() {
  const [locations, trips] = await Promise.all([getAllLocations(), getAllTrips()]);
  const tripLabels = Object.fromEntries(trips.map((t) => [t.id, t.title]));
  const tripColors = assignTripColors(trips);
  const routes = trips
    .filter((t) => t.route_geometry)
    .map((t) => ({ tripId: t.id, geometry: t.route_geometry! }));

  return (
    <AppShell>
      <div className="mx-auto flex h-full max-w-7xl flex-col space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Map</h2>
          <p className="mt-1 text-sm text-muted-foreground">Explore your routes</p>
        </div>
        <MapWrapper
          className="min-h-[500px] flex-1"
          locations={locations}
          routes={routes}
          tripLabels={tripLabels}
          tripColors={tripColors}
        />
      </div>
    </AppShell>
  );
}
