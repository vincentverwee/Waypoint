'use client';

import { Trip } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { CalendarDays, Navigation, Pencil, Trash2, MapPin, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

interface TripCardProps {
  trip: Trip;
  index: number;
  onEdit: (trip: Trip) => void;
  onDelete: (id: string) => void;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function TripCard({ trip, index, onEdit, onDelete }: TripCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06 }}
    >
      <Card className="group border-border/50 transition-shadow hover:shadow-md">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3">
            <Link href={`/trips/${trip.id}`} className="min-w-0 flex-1">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-xl bg-primary/10 p-2 shrink-0">
                  <MapPin size={18} className="text-primary" />
                </div>
                <div className="min-w-0">
                  <h3 className="truncate font-semibold group-hover:text-primary transition-colors">
                    {trip.title}
                  </h3>
                  {trip.description && (
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {trip.description}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {trip.start_date && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <CalendarDays size={11} />
                        {formatDate(trip.start_date)}
                        {trip.end_date && ` – ${formatDate(trip.end_date)}`}
                      </span>
                    )}
                    {trip.total_km && (
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <Navigation size={10} />
                        {trip.total_km.toLocaleString()} km
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      className="text-xs"
                    >
                      {trip.route_preference === 'avoid_tolls' ? 'No tolls' : 'Allow tolls'}
                    </Badge>
                  </div>
                </div>
              </div>
            </Link>

            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => onEdit(trip)}
              >
                <Pencil size={14} />
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                  >
                    <Trash2 size={14} />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete trip?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete <strong>{trip.title}</strong> and all its
                      locations. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => onDelete(trip.id)}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <Link href={`/trips/${trip.id}`}>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <ChevronRight size={16} />
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
