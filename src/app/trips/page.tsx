import { AppShell } from '@/components/layout/AppShell';
import { Route } from 'lucide-react';

export default function TripsPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Trips</h2>
          <p className="mt-1 text-sm text-muted-foreground">Manage your road trips</p>
        </div>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-24 text-center">
          <Route size={48} className="mb-4 text-muted-foreground/50" />
          <p className="font-medium text-muted-foreground">Trip management coming in Milestone 2</p>
        </div>
      </div>
    </AppShell>
  );
}
