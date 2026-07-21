'use client';

import { motion } from 'framer-motion';
import { Trip } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, Navigation } from 'lucide-react';

interface RecentTripsProps {
  trips: Trip[];
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function RecentTrips({ trips }: RecentTripsProps) {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Recent Trips</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {trips.map((trip, i) => (
          <motion.div
            key={trip.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + i * 0.07 }}
            className="flex cursor-pointer items-center justify-between rounded-xl bg-muted/50 p-4 transition-colors hover:bg-muted"
          >
            <div className="min-w-0 space-y-1">
              <p className="truncate text-sm font-medium">{trip.title}</p>
              {trip.start_date && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <CalendarDays size={12} />
                  {formatDate(trip.start_date)}
                </p>
              )}
            </div>
            {trip.total_km && (
              <Badge variant="secondary" className="ml-3 shrink-0 gap-1 text-xs">
                <Navigation size={10} />
                {trip.total_km.toLocaleString()} km
              </Badge>
            )}
          </motion.div>
        ))}
      </CardContent>
    </Card>
  );
}
