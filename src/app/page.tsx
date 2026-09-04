import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { StatsGrid } from '@/components/dashboard/StatsGrid';
import { RecentTrips } from '@/components/dashboard/RecentTrips';
import { MapWrapper } from '@/components/map/MapWrapper';
import { Button } from '@/components/ui/button';
import { getDashboardStats, getRecentTrips, getAllLocations } from '@/lib/data';
import { assignTripColors } from '@/lib/tripColors';
import { ImageDown } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const [stats, recentTrips, locations] = await Promise.all([
    getDashboardStats(),
    getRecentTrips(5),
    getAllLocations(),
  ]);
  const tripLabels = Object.fromEntries(recentTrips.map((t) => [t.id, t.title]));
  const tripColors = assignTripColors(recentTrips);
  const routes = recentTrips
    .filter((t) => t.route_geometry)
    .map((t) => ({ tripId: t.id, geometry: t.route_geometry! }));

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="mt-1 text-sm text-muted-foreground">Your travel journey at a glance</p>
        </div>

        <StatsGrid stats={stats} />

        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-muted-foreground">All trips</p>
              {/* Exports the whole map (every trip, not just the 5 plotted here) as one post. */}
              <Link href="/map/export" title="Export the whole map as an image">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <ImageDown size={15} />
                  Export map
                </Button>
              </Link>
            </div>
            <MapWrapper
              className="h-[400px] lg:h-[500px]"
              locations={locations}
              routes={routes}
              tripLabels={tripLabels}
              tripColors={tripColors}
              markerStyle="dot"
              selectable
            />
          </div>
          <RecentTrips trips={recentTrips} />
        </div>
      </div>
    </AppShell>
  );
}
