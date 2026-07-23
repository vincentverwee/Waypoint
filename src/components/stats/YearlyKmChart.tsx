import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { YearlyStats } from '@/lib/stats';

interface YearlyKmChartProps {
  data: YearlyStats[];
}

export function YearlyKmChart({ data }: YearlyKmChartProps) {
  const maxKm = Math.max(...data.map((d) => d.totalKm), 1);

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Km per Year</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Add start dates to your trips to see yearly totals
          </p>
        ) : (
          <div className="flex items-end gap-4 border-t border-border pt-4">
            {data.map((entry) => (
              <div
                key={entry.year}
                className="flex flex-1 flex-col items-center gap-2"
                title={`${entry.year}: ${entry.totalKm.toLocaleString()} km · ${entry.tripsCount} trip${entry.tripsCount === 1 ? '' : 's'}`}
              >
                <span className="text-xs font-medium">{entry.totalKm.toLocaleString()}</span>
                <div className="flex h-40 w-full max-w-16 items-end">
                  <div
                    className="w-full rounded-t-md bg-primary"
                    style={{ height: `${(entry.totalKm / maxKm) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">{entry.year}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
