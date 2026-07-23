import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, MapPin, Navigation } from 'lucide-react';
import { TripBreakdownEntry } from '@/lib/stats';

interface TripBreakdownProps {
  data: TripBreakdownEntry[];
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateRange(start: string | null, end: string | null) {
  if (!start) return null;
  if (!end || end === start) return formatDate(start);
  return `${formatDate(start)} – ${formatDate(end)}`;
}

export function TripBreakdown({ data }: TripBreakdownProps) {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Per-Trip Breakdown</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {data.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No trips yet</p>
        ) : (
          data.map(({ trip, cityCount }) => {
            const dateRange = formatDateRange(trip.start_date, trip.end_date);
            return (
              <div
                key={trip.id}
                className="flex items-center justify-between rounded-xl bg-muted/50 p-4 transition-colors hover:bg-muted"
              >
                <div className="min-w-0 space-y-1">
                  <p className="truncate text-sm font-medium">{trip.title}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {dateRange && (
                      <span className="flex items-center gap-1">
                        <CalendarDays size={12} />
                        {dateRange}
                      </span>
                    )}
                    {cityCount > 0 && (
                      <span className="flex items-center gap-1">
                        <MapPin size={12} />
                        {cityCount} {cityCount === 1 ? 'city' : 'cities'}
                      </span>
                    )}
                  </div>
                </div>
                {trip.total_km != null && (
                  <Badge variant="secondary" className="ml-3 shrink-0 gap-1 text-xs">
                    <Navigation size={10} />
                    {trip.total_km.toLocaleString()} km
                  </Badge>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
