'use client';

import { useState, useEffect, use } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { LocationList } from '@/components/trips/LocationList';
import { LocationSearch } from '@/components/trips/LocationSearch';
import { TripDialog } from '@/components/trips/TripDialog';
import { MapWrapper } from '@/components/map/MapWrapper';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Trip, Location } from '@/types';
import {
  getTripWithLocations,
  updateTrip,
  updateTripRoute,
  CreateTripInput,
  createLocation,
  deleteLocation,
  updateLocation,
  reorderLocations,
} from '@/lib/trips-store';
import { calculateRoute } from '@/lib/routing/osrm';
import { CalendarDays, Navigation, Pencil, ArrowLeft, MapPin } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [routeGeometry, setRouteGeometry] = useState<GeoJSON.LineString | null>(null);
  const [routing, setRouting] = useState(false);

  useEffect(() => {
    getTripWithLocations(id).then(({ trip, locations }) => {
      setTrip(trip);
      setLocations(locations);
      setRouteGeometry(trip.route_geometry);
      setLoading(false);
    });
  }, [id]);

  const displayedRouteGeometry = locations.length < 2 ? null : routeGeometry;

  useEffect(() => {
    if (locations.length < 2) return;

    let cancelled = false;
    // Standard fetch-on-mount pattern (React docs); the rule flags the "mark as loading"
    // call itself even though nothing external is synchronized before the async call resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRouting(true);
    calculateRoute(locations).then((result) => {
      if (cancelled || !result) {
        setRouting(false);
        return;
      }
      setRouteGeometry(result.geometry);
      setTrip((prev) => (prev ? { ...prev, total_km: result.distanceKm } : prev));
      setRouting(false);
      updateTripRoute(id, { total_km: result.distanceKm, route_geometry: result.geometry }).catch(
        () => {}
      );
    });

    return () => {
      cancelled = true;
    };
  }, [id, locations]);

  async function handleEditSave(data: CreateTripInput) {
    if (!trip) return;
    const updated = await updateTrip(trip.id, data);
    setTrip(updated);
  }

  async function addLocation(loc: Omit<Location, 'id' | 'created_at' | 'updated_at'>) {
    const created = await createLocation({ ...loc, visit_order: locations.length });
    setLocations((prev) => [...prev, created]);
  }

  async function removeLocation(locId: string) {
    await deleteLocation(locId);
    const reordered = locations
      .filter((l) => l.id !== locId)
      .map((l, i) => ({ ...l, visit_order: i }));
    setLocations(reordered);
    await reorderLocations(reordered);
  }

  async function moveUp(locId: string) {
    const idx = locations.findIndex((l) => l.id === locId);
    if (idx <= 0) return;
    const next = [...locations];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    const reordered = next.map((l, i) => ({ ...l, visit_order: i }));
    setLocations(reordered);
    await reorderLocations(reordered);
  }

  async function moveDown(locId: string) {
    const idx = locations.findIndex((l) => l.id === locId);
    if (idx >= locations.length - 1) return;
    const next = [...locations];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    const reordered = next.map((l, i) => ({ ...l, visit_order: i }));
    setLocations(reordered);
    await reorderLocations(reordered);
  }

  async function updateDates(locId: string, arrival: string, departure: string) {
    const arrival_date = arrival || null;
    const departure_date = departure || null;
    setLocations((prev) =>
      prev.map((l) => (l.id === locId ? { ...l, arrival_date, departure_date } : l))
    );
    await updateLocation(locId, { arrival_date, departure_date });
  }

  async function updateNotes(locId: string, notes: string) {
    const notesValue = notes || null;
    setLocations((prev) => prev.map((l) => (l.id === locId ? { ...l, notes: notesValue } : l)));
    await updateLocation(locId, { notes: notesValue });
  }

  if (loading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-5xl space-y-4">
          <div className="h-8 w-48 animate-pulse rounded-xl bg-muted" />
          <div className="h-32 animate-pulse rounded-2xl bg-muted" />
        </div>
      </AppShell>
    );
  }

  if (!trip) {
    return (
      <AppShell>
        <div className="flex flex-col items-center py-24">
          <p className="text-muted-foreground">Trip not found</p>
          <Link href="/trips" className="mt-4">
            <Button variant="outline">Back to trips</Button>
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Back + header */}
        <div className="flex items-start gap-4">
          <Link href="/trips">
            <Button variant="ghost" size="icon" className="mt-1 shrink-0">
              <ArrowLeft size={18} />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-2xl font-bold tracking-tight">{trip.title}</h2>
                {trip.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{trip.description}</p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {trip.start_date && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <CalendarDays size={12} />
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
                  <Badge variant="outline" className="text-xs">
                    {trip.route_preference === 'avoid_tolls' ? 'No tolls' : 'Allow tolls'}
                  </Badge>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 gap-2"
                onClick={() => setEditOpen(true)}
              >
                <Pencil size={14} />
                Edit
              </Button>
            </div>
          </div>
        </div>

        <Separator />

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* Left: locations */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-primary" />
              <h3 className="font-semibold">
                Locations
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({locations.length})
                </span>
              </h3>
            </div>

            <LocationSearch tripId={id} onAdd={addLocation} />

            <motion.div layout>
              <LocationList
                locations={locations}
                onRemove={removeLocation}
                onMoveUp={moveUp}
                onMoveDown={moveDown}
                onUpdateDates={updateDates}
                onUpdateNotes={updateNotes}
              />
            </motion.div>
          </div>

          {/* Right: map */}
          <div className="space-y-3">
            <h3 className="font-semibold">
              Route
              {routing && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  Calculating…
                </span>
              )}
            </h3>
            <MapWrapper
              className="h-[400px] lg:h-[500px]"
              locations={locations}
              routeGeometry={displayedRouteGeometry}
            />
            {locations.length < 2 && (
              <p className="text-center text-xs text-muted-foreground">
                Add at least 2 locations to see the route
              </p>
            )}
          </div>
        </div>
      </div>

      <TripDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        trip={trip}
        onSave={handleEditSave}
      />
    </AppShell>
  );
}
