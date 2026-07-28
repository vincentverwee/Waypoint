'use client';

import { cn } from '@/lib/utils';

export interface LegendChip {
  id: string;
  label: string;
  color: string;
}

interface TripLegendProps {
  chips: LegendChip[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  className?: string;
}

/**
 * Mobile-first trip selector — a horizontally-scrolling strip of tappable chips (big touch targets,
 * no hover needed). Tapping a chip focuses that trip on the map (its routes lift, others dim);
 * tapping it again, or the leading "All trips" chip, returns to the shared-corridor overview.
 * Kept in sync with the map: tapping a route/dot updates `selectedId` here too.
 */
export function TripLegend({ chips, selectedId, onSelect, className }: TripLegendProps) {
  if (chips.length === 0) return null;

  return (
    <div
      className={cn(
        'flex shrink-0 items-center gap-2 overflow-x-auto pb-1',
        // hide scrollbar but keep scrollability (touch)
        '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(null)}
        aria-pressed={selectedId === null}
        className={cn(
          'inline-flex h-9 shrink-0 items-center rounded-full border px-3 text-sm font-medium transition-colors',
          selectedId === null
            ? 'border-foreground/20 bg-foreground text-background'
            : 'border-border bg-background text-muted-foreground hover:bg-muted'
        )}
      >
        All trips
      </button>

      {chips.map((chip) => {
        const active = selectedId === chip.id;
        return (
          <button
            key={chip.id}
            type="button"
            onClick={() => onSelect(active ? null : chip.id)}
            aria-pressed={active}
            title={chip.label}
            className={cn(
              'inline-flex h-9 max-w-[10rem] shrink-0 items-center gap-2 rounded-full border px-3 text-sm font-medium transition-colors',
              active
                ? 'border-transparent text-white shadow-sm'
                : 'border-border bg-background text-foreground hover:bg-muted'
            )}
            style={active ? { backgroundColor: chip.color } : undefined}
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-white/70"
              style={{ backgroundColor: chip.color }}
            />
            <span className="truncate">{chip.label}</span>
          </button>
        );
      })}
    </div>
  );
}
