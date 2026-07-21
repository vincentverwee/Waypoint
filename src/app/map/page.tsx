import { AppShell } from '@/components/layout/AppShell';
import { MapWrapper } from '@/components/map/MapWrapper';

export default function MapPage() {
  return (
    <AppShell>
      <div className="mx-auto flex h-full max-w-7xl flex-col space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Map</h2>
          <p className="mt-1 text-sm text-muted-foreground">Explore your routes</p>
        </div>
        <MapWrapper className="min-h-[500px] flex-1" />
      </div>
    </AppShell>
  );
}
