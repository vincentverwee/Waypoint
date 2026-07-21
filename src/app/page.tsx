import { AppShell } from '@/components/layout/AppShell';
import { StatsGrid } from '@/components/dashboard/StatsGrid';
import { RecentTrips } from '@/components/dashboard/RecentTrips';
import { MapWrapper } from '@/components/map/MapWrapper';
import { getDashboardStats, getRecentTrips } from '@/lib/data';

export default async function DashboardPage() {
  const [stats, recentTrips] = await Promise.all([getDashboardStats(), getRecentTrips(5)]);

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="mt-1 text-sm text-muted-foreground">Your travel journey at a glance</p>
        </div>

        <StatsGrid stats={stats} />

        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <MapWrapper className="h-[400px] lg:h-[500px]" />
          <RecentTrips trips={recentTrips} />
        </div>
      </div>
    </AppShell>
  );
}
