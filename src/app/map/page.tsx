import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { MapWrapper } from '@/components/map/MapWrapper';
import { Button } from '@/components/ui/button';
import { getAllLocations, getAllTrips } from '@/lib/data';
import { assignTripColors } from '@/lib/tripColors';
import { ImageDown } from 'lucide-react';

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
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Map</h2>
            <p className="mt-1 text-sm text-muted-foreground">Explore your routes</p>
          </div>
          <Link href="/map/export" title="Export the whole map as an image">
            <Button variant="outline" size="sm" className="gap-1.5">
              <ImageDown size={15} />
              Export map
            </Button>
          </Link>
        </div>
        <MapWrapper
          className="min-h-[500px] flex-1"
          locations={locations}
          routes={routes}
          tripLabels={tripLabels}
          tripColors={tripColors}
          selectable
        />
      </div>
    </AppShell>
  );
}
