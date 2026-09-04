'use client';

import { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { MapWrapper } from '@/components/map/MapWrapper';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Trip, Location } from '@/types';
import { getTrips, getAllLocations } from '@/lib/trips-store';
import { assignTripColors } from '@/lib/tripColors';
import { useImageExport, isIOS } from '@/hooks/useImageExport';
import {
  EXPORT_FORMATS,
  DESIGN_WIDTH,
  PREVIEW_MAX_WIDTH,
  SANS_STACK,
  slugify,
} from '@/lib/exportFormats';
import {
  ArrowLeft,
  Download,
  Sun,
  Moon,
  ImageDown,
  Check,
  RotateCcw,
  Share2,
  X,
} from 'lucide-react';

const FORMATS = EXPORT_FORMATS;
const DEFAULT_ACCENT = '#4f46e5';

interface LegendEntry {
  id: string;
  name: string;
  color: string;
}

interface ExportStageProps {
  width: number;
  height: number;
  mapKey: string;
  locations: Location[];
  routes: { tripId: string; geometry: GeoJSON.LineString }[];
  tripColors: Record<string, string>;
  showDots: boolean;
  theme: 'light' | 'dark';
  accentColor: string;
  headline: string;
  legend: LegendEntry[];
  statsLine: string;
  totalKm: number;
}

/** The composed post: the whole multi-trip map, with a caption scrim across the bottom.
 *  Sized against a 1080px design so the shrunk preview and the full-res capture match. */
function ExportStage({
  width,
  height,
  mapKey,
  locations,
  routes,
  tripColors,
  showDots,
  theme,
  accentColor,
  headline,
  legend,
  statsLine,
  totalKm,
}: ExportStageProps) {
  const scale = width / DESIGN_WIDTH;
  const isDark = theme === 'dark';
  const textColor = isDark ? '#ffffff' : '#111111';

  // Measure the caption block so the map reserves exactly that much space at the bottom —
  // a long trip legend would otherwise sit on top of the routes.
  const captionRef = useRef<HTMLDivElement>(null);
  const [captionH, setCaptionH] = useState(0);
  useLayoutEffect(() => {
    if (captionRef.current) setCaptionH(captionRef.current.offsetHeight);
  }, [headline, legend, statsLine, totalKm, scale]);
  const reserveBottom = Math.round(captionH + (64 + 28) * scale);

  // Long headlines step down a size so they don't wrap into the map.
  const headlineSize = headline.length > 26 ? 62 : headline.length > 16 ? 74 : 88;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-muted" style={{ width, height }}>
      <MapWrapper
        key={mapKey}
        className="absolute inset-0"
        locations={locations}
        routes={routes}
        tripColors={tripColors}
        markerStyle={showDots ? 'dot' : 'none'}
        reserveBottom={reserveBottom}
        showControls={false}
        pixelRatio={1}
      />
      <div
        className="absolute inset-x-0 bottom-0"
        style={{
          padding: `${120 * scale}px ${56 * scale}px ${64 * scale}px`,
          background: isDark
            ? 'linear-gradient(to top, rgba(0,0,0,0.88), rgba(0,0,0,0))'
            : 'linear-gradient(to top, rgba(255,255,255,0.94), rgba(255,255,255,0))',
          color: textColor,
          textAlign: 'center',
          fontFamily: SANS_STACK,
        }}
      >
        <div ref={captionRef}>
          <p
            style={{
              fontSize: headlineSize * scale,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
            }}
          >
            {headline}
          </p>

          {legend.length > 0 && (
            <div
              style={{
                marginTop: 26 * scale,
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'center',
                gap: `${12 * scale}px ${26 * scale}px`,
              }}
            >
              {legend.map((t) => (
                <span
                  key={t.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10 * scale,
                    fontSize: 30 * scale,
                    fontWeight: 600,
                    opacity: 0.92,
                  }}
                >
                  <span
                    style={{
                      width: 18 * scale,
                      height: 18 * scale,
                      borderRadius: 9999,
                      background: t.color,
                      flexShrink: 0,
                    }}
                  />
                  {t.name}
                </span>
              ))}
            </div>
          )}

          <div
            style={{
              marginTop: 30 * scale,
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 18 * scale,
            }}
          >
            {totalKm > 0 && (
              <span
                style={{
                  background: accentColor,
                  color: '#ffffff',
                  borderRadius: 999,
                  padding: `${12 * scale}px ${30 * scale}px`,
                  fontSize: 38 * scale,
                  fontWeight: 700,
                }}
              >
                {Math.round(totalKm).toLocaleString()} km
              </span>
            )}
            {statsLine && (
              <span style={{ fontSize: 34 * scale, opacity: 0.85, fontWeight: 600 }}>
                {statsLine}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AllTripsExportPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  // Which trips appear on the post. Defaults to all of them — this page is "the whole map".
  const [included, setIncluded] = useState<Set<string>>(new Set());
  // Per-trip caption overrides for the legend. Blank/absent falls back to the trip title.
  const [customLabels, setCustomLabels] = useState<Record<string, string>>({});
  const [customHeadline, setCustomHeadline] = useState('');
  const [showLegend, setShowLegend] = useState(true);
  const [showDots, setShowDots] = useState(true);
  const [formatId, setFormatId] = useState(FORMATS[0].id);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [accentColor, setAccentColor] = useState(DEFAULT_ACCENT);

  // Two-step render/save — see useImageExport for why (iOS drops a download fired after the
  // tap's user activation has expired).
  const {
    rendered,
    error: exportError,
    busy: exporting,
    render,
    save: handleSave,
    clear: clearRendered,
  } = useImageExport();

  // We capture the on-screen preview itself: it's already mounted, loaded and fitted, so there's
  // no second hidden map whose cold load we'd have to race. WYSIWYG.
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([getTrips(), getAllLocations()]).then(([trips, locations]) => {
      setTrips(trips);
      setLocations(locations);
      setIncluded(new Set(trips.map((t) => t.id)));
      setLoading(false);
    });
  }, []);

  // Colors are assigned across ALL trips, not just the included ones, so a trip keeps its hue
  // when you tick others off and on.
  const tripColors = useMemo(() => assignTripColors(trips), [trips]);

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

  if (trips.length === 0) {
    return (
      <AppShell>
        <div className="mx-auto max-w-5xl space-y-4">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft size={18} />
              </Button>
            </Link>
            <h2 className="text-2xl font-bold tracking-tight">Export map</h2>
          </div>
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-24 text-center">
            <ImageDown size={48} className="mb-4 text-muted-foreground/40" />
            <p className="font-medium text-muted-foreground">No trips yet</p>
            <p className="mt-1 text-sm text-muted-foreground/60">
              Add a trip with a few stops first — then the whole map exports as one post
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

  const displayName = (trip: Trip) => customLabels[trip.id]?.trim() || trip.title;

  const includedTrips = trips.filter((t) => included.has(t.id));
  const includedLocations = locations.filter((l) => included.has(l.trip_id));
  const routes = includedTrips
    .filter((t) => t.route_geometry)
    .map((t) => ({ tripId: t.id, geometry: t.route_geometry! }));

  const totalKm = includedTrips.reduce((sum, t) => sum + (t.total_km ?? 0), 0);
  const countries = new Set(includedLocations.map((l) => l.country).filter(Boolean)).size;
  const cities = new Set(includedLocations.map((l) => l.city).filter(Boolean)).size;
  const statsLine = [
    `${includedTrips.length} ${includedTrips.length === 1 ? 'trip' : 'trips'}`,
    countries > 0 ? `${countries} ${countries === 1 ? 'country' : 'countries'}` : null,
    cities > 0 ? `${cities} ${cities === 1 ? 'city' : 'cities'}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  // Default headline = the year (or year range) the included trips span.
  const years = includedTrips
    .map((t) => (t.start_date ? new Date(t.start_date).getFullYear() : null))
    .filter((y): y is number => y != null)
    .sort((a, b) => a - b);
  const defaultHeadline = years.length
    ? years[0] === years[years.length - 1]
      ? `Travels ${years[0]}`
      : `Travels ${years[0]}–${years[years.length - 1]}`
    : 'My travels';
  const headline = customHeadline.trim() || defaultHeadline;

  const legend: LegendEntry[] = showLegend
    ? includedTrips.map((t) => ({
        id: t.id,
        name: displayName(t),
        color: tripColors[t.id],
      }))
    : [];

  function toggleTrip(tripId: string) {
    clearRendered();
    setIncluded((prev) => {
      const next = new Set(prev);
      if (next.has(tripId)) next.delete(tripId);
      else next.add(tripId);
      return next;
    });
  }

  function setAll(on: boolean) {
    clearRendered();
    setIncluded(on ? new Set(trips.map((t) => t.id)) : new Set());
  }

  function handleRender() {
    if (!previewRef.current) return;
    // The preview renders the stage at FULL export resolution (it's only *displayed* shrunk via a
    // CSS transform on an ancestor), so we capture it 1:1 and MapLibre's native detail comes
    // through crisply. modern-screenshot clones from previewRef down, so the ancestor transform
    // doesn't scale the output.
    render(previewRef.current, {
      width: format.width,
      height: format.height,
      backgroundColor: theme === 'dark' ? '#000000' : '#ffffff',
      fileName: `${slugify(headline)}-${includedTrips.length}trips-${format.width}x${format.height}.png`,
    });
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft size={18} />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Export map — all trips</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Every trip on one map, each in its own color. Tick the trips to include, rename them
              for the legend, and set a headline.
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
                      Trips
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                        ({includedTrips.length}/{trips.length})
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
                  <div className="max-h-80 space-y-1 overflow-y-auto rounded-xl border border-border/60 p-1">
                    {trips.map((trip) => {
                      const on = included.has(trip.id);
                      const custom = customLabels[trip.id] ?? '';
                      return (
                        <div
                          key={trip.id}
                          className={`flex items-center gap-2 rounded-lg px-1.5 py-1 transition-colors ${
                            on ? 'bg-primary/5' : 'opacity-55 hover:opacity-100'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleTrip(trip.id)}
                            className="flex shrink-0 items-center gap-2"
                            title={on ? 'On the map — click to remove' : 'Click to add to the map'}
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
                            <span
                              className="h-3 w-3 shrink-0 rounded-full"
                              style={{ background: tripColors[trip.id] }}
                              title="Its color on the map"
                            />
                          </button>
                          <input
                            value={custom}
                            placeholder={trip.title}
                            onChange={(e) =>
                              setCustomLabels((prev) => ({ ...prev, [trip.id]: e.target.value }))
                            }
                            className="min-w-0 flex-1 rounded-md bg-transparent px-1.5 py-1 text-sm outline-none placeholder:text-muted-foreground/70 focus:bg-background focus:ring-1 focus:ring-ring"
                          />
                          {custom.trim() && (
                            <button
                              type="button"
                              onClick={() =>
                                setCustomLabels((prev) => {
                                  const next = { ...prev };
                                  delete next[trip.id];
                                  return next;
                                })
                              }
                              className="shrink-0 text-muted-foreground/50 transition-colors hover:text-foreground"
                              title="Reset to the trip title"
                            >
                              <RotateCcw size={13} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {routes.length < includedTrips.length
                      ? `${routes.length}/${includedTrips.length} have a route line — the rest show stops only`
                      : statsLine}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="headline">Headline</Label>
                  <div className="flex items-center gap-2">
                    <input
                      id="headline"
                      value={customHeadline}
                      placeholder={defaultHeadline}
                      onChange={(e) => {
                        clearRendered();
                        setCustomHeadline(e.target.value);
                      }}
                      className="min-w-0 flex-1 rounded-md border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground/70 focus:ring-1 focus:ring-ring"
                    />
                    {customHeadline.trim() && (
                      <button
                        type="button"
                        onClick={() => {
                          clearRendered();
                          setCustomHeadline('');
                        }}
                        className="shrink-0 text-muted-foreground/50 transition-colors hover:text-foreground"
                        title="Reset to the default headline"
                      >
                        <RotateCcw size={14} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Show</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant={showLegend ? 'default' : 'outline'}
                      size="sm"
                      className="text-xs"
                      onClick={() => {
                        clearRendered();
                        setShowLegend((v) => !v);
                      }}
                    >
                      Trip names
                    </Button>
                    <Button
                      variant={showDots ? 'default' : 'outline'}
                      size="sm"
                      className="text-xs"
                      onClick={() => {
                        clearRendered();
                        setShowDots((v) => !v);
                      }}
                    >
                      Stop dots
                    </Button>
                  </div>
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
                        onClick={() => {
                          clearRendered();
                          setFormatId(f.id);
                        }}
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
                      onClick={() => {
                        clearRendered();
                        setTheme('light');
                      }}
                    >
                      <Sun size={14} />
                      Light
                    </Button>
                    <Button
                      variant={theme === 'dark' ? 'default' : 'outline'}
                      size="sm"
                      className="gap-1.5"
                      onClick={() => {
                        clearRendered();
                        setTheme('dark');
                      }}
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
                      onChange={(e) => {
                        clearRendered();
                        setAccentColor(e.target.value);
                      }}
                      className="h-9 w-9 cursor-pointer rounded-lg border border-input p-0.5"
                    />
                    <span className="text-sm text-muted-foreground">{accentColor}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Used for the km badge only — routes keep their per-trip colors.
                  </p>
                </div>

                {/* Two steps on purpose: rendering takes seconds, and on iOS a save fired after
                    that delay has outlived the tap's user activation. See useImageExport. */}
                <Button
                  className="w-full gap-2"
                  disabled={exporting || includedTrips.length === 0}
                  onClick={handleRender}
                >
                  <ImageDown size={16} />
                  {exporting ? 'Rendering…' : rendered ? 'Render again' : 'Render image'}
                </Button>

                {exportError && (
                  <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3">
                    <p className="text-xs font-medium text-destructive">Rendering failed</p>
                    <p className="mt-1 break-words text-xs text-muted-foreground">{exportError}</p>
                  </div>
                )}

                {rendered && (
                  <div className="space-y-2 rounded-xl border border-border/60 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium">
                        Ready — {format.width}×{format.height}
                      </p>
                      <button
                        type="button"
                        onClick={clearRendered}
                        className="text-muted-foreground/60 transition-colors hover:text-foreground"
                        title="Discard"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={rendered.url}
                      alt="Exported map preview"
                      className="w-full rounded-lg border border-border/60"
                    />
                    <Button className="w-full gap-2" onClick={handleSave}>
                      {isIOS() ? <Share2 size={16} /> : <Download size={16} />}
                      {isIOS() ? 'Save image' : 'Download PNG'}
                    </Button>
                    <p className="text-[11px] leading-snug text-muted-foreground">
                      On iPhone: tap <strong>Save image</strong> and pick “Save Image”, or long-press
                      the picture above.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="flex items-start justify-center">
            {/* Rendered at FULL export resolution, only *displayed* shrunk via a transform on the
                scaler below — previewRef itself is untransformed, so it captures 1:1. */}
            <div style={{ width: previewWidth, height: previewHeight, overflow: 'hidden' }}>
              <div
                style={{
                  transform: `scale(${previewWidth / format.width})`,
                  transformOrigin: 'top left',
                }}
              >
                <div ref={previewRef} style={{ width: format.width, height: format.height }}>
                  <ExportStage
                    width={format.width}
                    height={format.height}
                    mapKey={formatId}
                    locations={includedLocations}
                    routes={routes}
                    tripColors={tripColors}
                    showDots={showDots}
                    theme={theme}
                    accentColor={accentColor}
                    headline={headline}
                    legend={legend}
                    statsLine={statsLine}
                    totalKm={totalKm}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
