'use client';

import { useState } from 'react';
import { Trip } from '@/types';
import { CreateTripInput } from '@/lib/trips-store';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface TripDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip?: Trip | null;
  onSave: (data: CreateTripInput) => Promise<void>;
}

const EMPTY: CreateTripInput = {
  title: '',
  description: '',
  start_date: '',
  end_date: '',
  route_preference: 'allow_tolls',
};

export function TripDialog({ open, onOpenChange, trip, onSave }: TripDialogProps) {
  const [form, setForm] = useState<CreateTripInput>(EMPTY);
  const [saving, setSaving] = useState(false);

  // Reset the form whenever the dialog opens for a (possibly different) trip.
  // Done during render, not in an effect, so the fields never flash stale content.
  const [syncedFor, setSyncedFor] = useState<{ trip?: Trip | null; open: boolean }>();
  if (!syncedFor || syncedFor.trip !== trip || syncedFor.open !== open) {
    setSyncedFor({ trip, open });
    setForm(
      trip
        ? {
            title: trip.title,
            description: trip.description ?? '',
            start_date: trip.start_date ?? '',
            end_date: trip.end_date ?? '',
            route_preference: trip.route_preference,
          }
        : EMPTY
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await onSave(form);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{trip ? 'Edit Trip' : 'New Trip'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="e.g. Summer Roadtrip 2026"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="A short description of this trip"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="start_date">Start date</Label>
              <Input
                id="start_date"
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end_date">End date</Label>
              <Input
                id="end_date"
                type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Route preference</Label>
            <Select
              value={form.route_preference}
              onValueChange={(v) =>
                setForm({ ...form, route_preference: v as CreateTripInput['route_preference'] })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="allow_tolls">Allow toll roads (fastest)</SelectItem>
                <SelectItem value="avoid_tolls">Avoid toll roads</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !form.title.trim()}>
              {saving ? 'Saving…' : trip ? 'Save changes' : 'Create trip'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
