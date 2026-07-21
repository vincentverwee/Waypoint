'use client';

import { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { TripCard } from '@/components/trips/TripCard';
import { TripDialog } from '@/components/trips/TripDialog';
import { Button } from '@/components/ui/button';
import { Trip } from '@/types';
import { CreateTripInput, createTrip, updateTrip, deleteTrip } from '@/lib/trips-store';
import { MOCK_TRIPS } from '@/lib/mock-data';
import { Plus, Route } from 'lucide-react';
import { motion } from 'framer-motion';

export default function TripsPage() {
  const [trips, setTrips] = useState<Trip[]>(MOCK_TRIPS);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);

  function openCreate() {
    setEditingTrip(null);
    setDialogOpen(true);
  }

  function openEdit(trip: Trip) {
    setEditingTrip(trip);
    setDialogOpen(true);
  }

  async function handleSave(data: CreateTripInput) {
    if (editingTrip) {
      const updated = await updateTrip(editingTrip.id, data);
      setTrips((prev) => prev.map((t) => (t.id === editingTrip.id ? updated : t)));
    } else {
      const created = await createTrip(data);
      setTrips((prev) => [created, ...prev]);
    }
  }

  async function handleDelete(id: string) {
    await deleteTrip(id);
    setTrips((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Trips</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {trips.length} trip{trips.length !== 1 ? 's' : ''} recorded
            </p>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus size={16} />
            New trip
          </Button>
        </div>

        {trips.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-24 text-center"
          >
            <Route size={48} className="mb-4 text-muted-foreground/40" />
            <p className="font-medium text-muted-foreground">No trips yet</p>
            <p className="mt-1 text-sm text-muted-foreground/60">
              Click &quot;New trip&quot; to start your first road trip
            </p>
            <Button onClick={openCreate} className="mt-6 gap-2" variant="outline">
              <Plus size={16} />
              Create first trip
            </Button>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {trips.map((trip, i) => (
              <TripCard
                key={trip.id}
                trip={trip}
                index={i}
                onEdit={openEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      <TripDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        trip={editingTrip}
        onSave={handleSave}
      />
    </AppShell>
  );
}
