import { AppShell } from '@/components/layout/AppShell';
import { StatsGrid } from '@/components/dashboard/StatsGrid';
import { RecentTrips } from '@/components/dashboard/RecentTrips';
import { MapWrapper } from '@/components/map/MapWrapper';
import { getDashboardStats, getRecentTrips, getAllLocations } from '@/lib/data';
import { assignTripColors } from '@/lib/tripColors';

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
          <MapWrapper
            className="h-[400px] lg:h-[500px]"
            locations={locations}
            routes={routes}
            tripLabels={tripLabels}
            tripColors={tripColors}
            markerStyle="dot"
          />
          <RecentTrips trips={recentTrips} />
        </div>
      </div>
    </AppShell>
  );
}
