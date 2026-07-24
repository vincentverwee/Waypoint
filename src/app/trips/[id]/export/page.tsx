'use client';

import { useState, useEffect, useRef, useCallback, useMemo, use } from 'react';
import Link from 'next/link';
import html2canvas from 'html2canvas';
import { AppShell } from '@/components/layout/AppShell';
import { MapWrapper } from '@/components/map/MapWrapper';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Trip, Location } from '@/types';
import { getTripWithLocations } from '@/lib/trips-store';
import { calculateRoute, RouteResult } from '@/lib/routing/osrm';
import { ArrowLeft, Download, Sun, Moon, ImageDown, Check } from 'lucide-react';

interface ExportFormat {
  id: string;
  label: string;
  width: number;
  height: number;
}

const FORMATS: ExportFormat[] = [
  { id: 'portrait', label: '1080 × 1350', width: 1080, height: 1350 },
  { id: 'story', label: '1080 × 1920', width: 1080, height: 1920 },
  { id: 'square-hd', label: '1920 × 1920', width: 1920, height: 1920 },
  { id: 'square', label: '1080 × 1080', width: 1080, height: 1080 },
];

const DESIGN_WIDTH = 1080;
const PREVIEW_MAX_WIDTH = 380;
const DEFAULT_ACCENT = '#4f46e5';
// Fallback ceiling in case the off-screen map's `idle` event never fires (network stall etc.).
const EXPORT_READY_TIMEOUT_MS = 8000;

function formatDate(dateStr: string | null) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function slugify(text: string) {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'trip'
  );
}

interface ExportStageProps {
  width: number;
  height: number;
  mapKey: string;
  locations: Location[];
  labeledIds: string[];
  routeGeometry: GeoJSON.LineString | null;
  accentColor: string;
  theme: 'light' | 'dark';
  chain: string;
  headline: string;
  addedKm: number | null;
  totalKm: number | null;
  arrivalDate: string | null;
  onReady?: () => void;
}

function ExportStage({
  width,
  height,
  mapKey,
  locations,
  labeledIds,
  routeGeometry,
  accentColor,
  theme,
  chain,
  headline,
  addedKm,
  totalKm,
  arrivalDate,
  onReady,
}: ExportStageProps) {
  // Overlay typography is sized relative to a 1080px-wide design so the small on-screen
  // preview and the full-resolution export capture stay proportionally identical.
  const scale = width / DESIGN_WIDTH;
  const isDark = theme === 'dark';
  const textColor = isDark ? '#ffffff' : '#111111';

  return (
    <div className="relative overflow-hidden rounded-2xl bg-muted" style={{ width, height }}>
      <MapWrapper
        key={mapKey}
        className="absolute inset-0"
        locations={locations}
        routeGeometry={routeGeometry}
        accentColor={accentColor}
        labeledIds={labeledIds}
        showControls={false}
        onReady={onReady}
      />
      <div
        className="absolute inset-x-0 bottom-0"
        style={{
          padding: `${120 * scale}px ${56 * scale}px ${64 * scale}px`,
          background: isDark
            ? 'linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0))'
            : 'linear-gradient(to top, rgba(255,255,255,0.92), rgba(255,255,255,0))',
          color: textColor,
          textAlign: 'center',
        }}
      >
        {chain && (
          <p style={{ fontSize: 30 * scale, marginBottom: 12 * scale, opacity: 0.85, fontWeight: 600 }}>
            {chain}
          </p>
        )}
        <p style={{ fontSize: 76 * scale, fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.02em' }}>
          {headline}
        </p>
        {arrivalDate && (
          <p style={{ fontSize: 28 * scale, marginTop: 12 * scale, opacity: 0.8 }}>{arrivalDate}</p>
        )}
        {(addedKm != null || totalKm != null) && (
          <div
            style={{
              marginTop: 28 * scale,
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16 * scale,
            }}
          >
            {addedKm != null && addedKm > 0 && (
              <span
                style={{
                  background: accentColor,
                  color: '#ffffff',
                  borderRadius: 999,
                  padding: `${10 * scale}px ${26 * scale}px`,
                  fontSize: 30 * scale,
                  fontWeight: 700,
                }}
              >
                +{addedKm.toLocaleString()} km
              </span>
            )}
            {totalKm != null && (
              <span style={{ fontSize: 30 * scale, opacity: 0.85, fontWeight: 600 }}>
                {totalKm.toLocaleString()} km total
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ExportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  // Ids of the stops to feature on this post. The whole trip is always drawn; these only
  // control which stops get a name label and which legs count toward the "+km added".
  const [included, setIncluded] = useState<Set<string>>(new Set());
  const [formatId, setFormatId] = useState(FORMATS[0].id);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [accentColor, setAccentColor] = useState(DEFAULT_ACCENT);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState(false);
  // The full-trip route — calculated ONCE per trip, never on checkbox changes.
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [exporting, setExporting] = useState(false);

  const captureRef = useRef<HTMLDivElement>(null);
  // Resolves the promise handleExport awaits — fired by the hidden capture map's onReady.
  const readyResolveRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    getTripWithLocations(id).then(({ trip, locations }) => {
      setTrip(trip);
      setLocations(locations);
      setIncluded(new Set(locations.map((l) => l.id)));
      setLoading(false);
    });
  }, [id]);

  useEffect(() => {
    if (locations.length < 2) return;
    let cancelled = false;
    // Standard fetch-on-mount: the rule flags the synchronous "mark as loading" call, but
    // nothing external is synchronized before the async request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRouteLoading(true);
    setRouteError(false);
    calculateRoute(locations)
      .then((result) => {
        if (cancelled) return;
        if (result) setRoute(result);
        else setRouteError(true);
      })
      .catch(() => {
        if (!cancelled) setRouteError(true);
      })
      .finally(() => {
        if (!cancelled) setRouteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [locations]);

  const handleCaptureReady = useCallback(() => {
    readyResolveRef.current?.();
    readyResolveRef.current = null;
  }, []);

  // Stable array identity so the map only rebuilds markers when the featured set changes.
  const labeledIds = useMemo(() => [...included], [included]);

  if (loading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-5xl space-y-4">
          <div className="h-8 w-48 animate-pulse rounded-xl bg-muted" />
          <div className="h-96 animate-pulse rounded-2xl bg-muted" />
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

  if (locations.length < 2) {
    return (
      <AppShell>
        <div className="mx-auto max-w-5xl space-y-4">
          <div className="flex items-center gap-3">
            <Link href={`/trips/${id}`}>
              <Button variant="ghost" size="icon">
                <ArrowLeft size={18} />
              </Button>
            </Link>
            <h2 className="text-2xl font-bold tracking-tight">Export</h2>
          </div>
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-24 text-center">
            <ImageDown size={48} className="mb-4 text-muted-foreground/40" />
            <p className="font-medium text-muted-foreground">Not enough stops yet</p>
            <p className="mt-1 text-sm text-muted-foreground/60">
              Add at least 2 locations on the trip page before exporting a post
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  const format = FORMATS.find((f) => f.id === formatId) ?? FORMATS[0];
  const previewScale = Math.min(1, PREVIEW_MAX_WIDTH / format.width);
  const previewWidth = Math.round(format.width * previewScale);
  const previewHeight = Math.round(format.height * previewScale);

  // Checked stops, in visit order — used for the name labels and the bottom chain/headline.
  const includedList = locations.filter((l) => included.has(l.id));
  const headline = includedList.length
    ? includedList[includedList.length - 1].name
    : trip.title;
  const chain = includedList
    .slice(0, -1)
    .map((l) => l.name)
    .join(' → ');
  const currentStop = includedList[includedList.length - 1] ?? null;
  // "+km added" = the legs that arrive at each checked stop, summed (each checked stop
  // attributes the leg that reaches it). Total km stays the full-trip distance, unchanged.
  const legs = route?.legsKm ?? [];
  const addedKm = route
    ? Math.round(
        locations.reduce(
          (sum, l, i) => (i > 0 && included.has(l.id) ? sum + (legs[i - 1] ?? 0) : sum),
          0
        ) * 10
      ) / 10
    : null;
  const totalKm = route?.distanceKm ?? null;
  const routeGeometry = route?.geometry ?? null;

  function toggleStop(locId: string) {
    setIncluded((prev) => {
      const next = new Set(prev);
      if (next.has(locId)) next.delete(locId);
      else next.add(locId);
      return next;
    });
  }

  function setAll(on: boolean) {
    setIncluded(on ? new Set(locations.map((l) => l.id)) : new Set());
  }

  async function handleExport() {
    if (!trip) return;
    setExporting(true);
    try {
      // Wait for the hidden full-resolution map to finish loading + fitting + painting.
      // Without this the capture races map load and grabs the blank default view.
      await new Promise<void>((resolve) => {
        readyResolveRef.current = resolve;
        setTimeout(() => {
          readyResolveRef.current = null;
          resolve();
        }, EXPORT_READY_TIMEOUT_MS);
      });
      // One more settle tick so marker/label DOM has laid out over the final frame.
      await new Promise((r) => setTimeout(r, 400));
      if (captureRef.current) {
        const canvas = await html2canvas(captureRef.current, {
          scale: 1,
          useCORS: true,
          backgroundColor: null,
          logging: false,
        });
        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = `${slugify(trip.title)}-${includedList.length}stops-${format.width}x${format.height}.png`;
        link.click();
      }
    } finally {
      setExporting(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center gap-3">
          <Link href={`/trips/${id}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft size={18} />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Export — {trip.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              The whole trip is always shown — tick the stops to feature, and only they get a name
              label and count toward the “+km added”
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          <div className="space-y-4">
            <Card className="border-border/50">
              <CardContent className="space-y-5 p-5">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>
                      Stops
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                        ({includedList.length}/{locations.length})
                      </span>
                    </Label>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setAll(true)}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        All
                      </button>
                      <span className="text-xs text-muted-foreground/40">·</span>
                      <button
                        type="button"
                        onClick={() => setAll(false)}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        None
                      </button>
                    </div>
                  </div>
                  <div className="max-h-72 space-y-1 overflow-y-auto rounded-xl border border-border/60 p-1">
                    {locations.map((loc, i) => {
                      const on = included.has(loc.id);
                      return (
                        <button
                          type="button"
                          key={loc.id}
                          onClick={() => toggleStop(loc.id)}
                          className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors ${
                            on ? 'bg-primary/5' : 'opacity-55 hover:opacity-100'
                          }`}
                        >
                          <span
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                              on
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-muted-foreground/40'
                            }`}
                          >
                            {on && <Check size={12} strokeWidth={3} />}
                          </span>
                          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                            {i + 1}.
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm">{loc.name}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {routeLoading
                      ? 'Calculating route…'
                      : routeError
                        ? 'Route calculation failed — retry by reloading; stops still show'
                        : totalKm != null
                          ? `${totalKm.toLocaleString()} km total · ${includedList.length} featured${
                              addedKm ? ` · +${addedKm.toLocaleString()} km` : ''
                            }`
                          : ' '}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Format</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {FORMATS.map((f) => (
                      <Button
                        key={f.id}
                        variant={f.id === formatId ? 'default' : 'outline'}
                        size="sm"
                        className="text-xs"
                        onClick={() => setFormatId(f.id)}
                      >
                        {f.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Theme</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant={theme === 'light' ? 'default' : 'outline'}
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setTheme('light')}
                    >
                      <Sun size={14} />
                      Light
                    </Button>
                    <Button
                      variant={theme === 'dark' ? 'default' : 'outline'}
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setTheme('dark')}
                    >
                      <Moon size={14} />
                      Dark
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="accent-color">Accent color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      id="accent-color"
                      type="color"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="h-9 w-9 cursor-pointer rounded-lg border border-input p-0.5"
                    />
                    <span className="text-sm text-muted-foreground">{accentColor}</span>
                  </div>
                </div>

                <Button
                  className="w-full gap-2"
                  disabled={exporting || routeLoading}
                  onClick={handleExport}
                >
                  <Download size={16} />
                  {exporting ? 'Rendering…' : 'Export PNG'}
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="flex items-start justify-center">
            <div style={{ width: previewWidth, height: previewHeight }}>
              <ExportStage
                width={previewWidth}
                height={previewHeight}
                mapKey={formatId}
                locations={locations}
                labeledIds={labeledIds}
                routeGeometry={routeGeometry}
                accentColor={accentColor}
                theme={theme}
                chain={chain}
                headline={headline}
                addedKm={addedKm}
                totalKm={totalKm}
                arrivalDate={formatDate(currentStop?.arrival_date ?? null)}
              />
            </div>
          </div>
        </div>
      </div>

      {exporting && (
        <div style={{ position: 'fixed', left: -9999, top: 0 }}>
          <div ref={captureRef}>
            <ExportStage
              width={format.width}
              height={format.height}
              mapKey="capture"
              locations={locations}
              labeledIds={labeledIds}
              routeGeometry={routeGeometry}
              accentColor={accentColor}
              theme={theme}
              chain={chain}
              headline={headline}
              addedKm={addedKm}
              totalKm={totalKm}
              arrivalDate={formatDate(currentStop?.arrival_date ?? null)}
              onReady={handleCaptureReady}
            />
          </div>
        </div>
      )}
    </AppShell>
  );
}
