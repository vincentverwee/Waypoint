'use client';

import { useState } from 'react';
import { Location } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { MapPin, Trash2, ChevronUp, ChevronDown, CalendarDays, StickyNote } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface LocationListProps {
  locations: Location[];
  onRemove: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onUpdateDates: (id: string, arrival: string, departure: string) => void;
  onUpdateNotes: (id: string, notes: string) => void;
}

export function LocationList({
  locations,
  onRemove,
  onMoveUp,
  onMoveDown,
  onUpdateDates,
  onUpdateNotes,
}: LocationListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (locations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-12 text-center">
        <MapPin size={32} className="mb-3 text-muted-foreground/40" />
        <p className="text-sm font-medium text-muted-foreground">No locations yet</p>
        <p className="mt-1 text-xs text-muted-foreground/60">
          Use the search above to add your first stop
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Vertical route line */}
      {locations.length > 1 && (
        <div className="absolute left-[19px] top-8 bottom-8 w-0.5 bg-border" />
      )}

      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {locations.map((loc, i) => {
            const isExpanded = expandedId === loc.id;
            const isFirst = i === 0;
            const isLast = i === locations.length - 1;

            return (
              <motion.div
                key={loc.id}
                layout
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="relative"
              >
                <div className="flex items-start gap-3">
                  {/* Order indicator */}
                  <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-card text-xs font-bold text-primary">
                    {i + 1}
                  </div>

                  <div className="flex-1 overflow-hidden rounded-xl border border-border bg-card">
                    <div className="flex items-center justify-between gap-2 p-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-sm">{loc.name}</p>
                        {loc.country && (
                          <p className="text-xs text-muted-foreground">{loc.country}</p>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setExpandedId(isExpanded ? null : loc.id)}
                          title="Edit dates & notes"
                        >
                          <CalendarDays size={13} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => onMoveUp(loc.id)}
                          disabled={isFirst}
                        >
                          <ChevronUp size={13} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => onMoveDown(loc.id)}
                          disabled={isLast}
                        >
                          <ChevronDown size={13} />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                            >
                              <Trash2 size={13} />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove location?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Remove <strong>{loc.name}</strong> from this trip?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => onRemove(loc.id)}
                              >
                                Remove
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>

                    {/* Expanded: dates and notes */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden border-t border-border"
                        >
                          <div className="grid grid-cols-2 gap-3 p-3 pb-3">
                            <div className="space-y-1">
                              <label className="text-xs font-medium text-muted-foreground">
                                Arrival
                              </label>
                              <Input
                                type="date"
                                defaultValue={loc.arrival_date ?? ''}
                                className="h-8 text-xs"
                                onBlur={(e) =>
                                  onUpdateDates(loc.id, e.target.value, loc.departure_date ?? '')
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-medium text-muted-foreground">
                                Departure
                              </label>
                              <Input
                                type="date"
                                defaultValue={loc.departure_date ?? ''}
                                className="h-8 text-xs"
                                onBlur={(e) =>
                                  onUpdateDates(loc.id, loc.arrival_date ?? '', e.target.value)
                                }
                              />
                            </div>
                            <div className="col-span-2 space-y-1">
                              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                <StickyNote size={11} />
                                Notes
                              </label>
                              <textarea
                                defaultValue={loc.notes ?? ''}
                                placeholder="Add notes about this stop…"
                                rows={2}
                                className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                onBlur={(e) => onUpdateNotes(loc.id, e.target.value)}
                              />
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
