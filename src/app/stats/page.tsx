import { AppShell } from '@/components/layout/AppShell';
import { BarChart3 } from 'lucide-react';

export default function StatsPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Statistics</h2>
          <p className="mt-1 text-sm text-muted-foreground">Deep dive into your travel data</p>
        </div>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-24 text-center">
          <BarChart3 size={48} className="mb-4 text-muted-foreground/50" />
          <p className="font-medium text-muted-foreground">
            Statistics dashboard coming in Milestone 4
          </p>
        </div>
      </div>
    </AppShell>
  );
}
