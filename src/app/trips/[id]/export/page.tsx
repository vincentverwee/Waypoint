'use client';

import { useState, useEffect, useLayoutEffect, useRef, useMemo, use } from 'react';
import Link from 'next/link';
import { domToBlob } from 'modern-screenshot';
import { AppShell } from '@/components/layout/AppShell';
import { MapWrapper } from '@/components/map/MapWrapper';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Trip, Location } from '@/types';
import { getTripWithLocations } from '@/lib/trips-store';
import { calculateRoute, RouteResult } from '@/lib/routing/osrm';
import { ArrowLeft, Download, Sun, Moon, ImageDown, Check, RotateCcw, Share2, X } from 'lucide-react';

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
// Concrete sans stack so the export never falls back to serif if Inter isn't embedded in time.
const SANS_STACK =
  "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

function formatDate(dateStr: string | null) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** iOS/iPadOS (incl. iPadOS reporting itself as "MacIntel" with a touch screen). */
function isIOS() {
  if (typeof navigator === 'undefined') return false;
  return (
    /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
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

interface CaptionStop {
  name: string;
  secondary: string | null;
}

interface ExportStageProps {
  width: number;
  height: number;
  mapKey: string;
  locations: Location[];
  labeledIds: string[];
  labelOverrides: Record<string, string>;
  routeGeometry: GeoJSON.LineString | null;
  accentColor: string;
  theme: 'light' | 'dark';
  captionStops: CaptionStop[];
  /** Name font size (in 1080px-design px) — shared by every stop so they read as equal-weight. */
  nameSize: number;
  addedKm: number | null;
  totalKm: number | null;
  /** Forced canvas pixel ratio for the map — the capture stage passes 1 (see handleExport). */
  pixelRatio?: number;
  onReady?: () => void;
}

function ExportStage({
  width,
  height,
  mapKey,
  locations,
  labeledIds,
  labelOverrides,
  routeGeometry,
  accentColor,
  theme,
  captionStops,
  nameSize,
  addedKm,
  totalKm,
  pixelRatio,
  onReady,
}: ExportStageProps) {
  // Overlay typography is sized relative to a 1080px-wide design so the small on-screen
  // preview and the full-resolution export capture stay proportionally identical.
  const scale = width / DESIGN_WIDTH;
  const isDark = theme === 'dark';
  const textColor = isDark ? '#ffffff' : '#111111';

  // Measure the caption text block so the map can reserve exactly that much space at the bottom
  // (instead of a fixed 32%) — otherwise a tall multi-stop caption overlaps the markers/route.
  const captionRef = useRef<HTMLDivElement>(null);
  const [captionH, setCaptionH] = useState(0);
  useLayoutEffect(() => {
    if (captionRef.current) setCaptionH(captionRef.current.offsetHeight);
  }, [captionStops, nameSize, addedKm, totalKm, scale]);
  // Reserve = caption text height + the caption's bottom padding + a little clearance.
  const reserveBottom = Math.round(captionH + (64 + 28) * scale);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-muted" style={{ width, height }}>
      <MapWrapper
        key={mapKey}
        className="absolute inset-0"
        locations={locations}
        routeGeometry={routeGeometry}
        accentColor={accentColor}
        labeledIds={labeledIds}
        labelOverrides={labelOverrides}
        reserveBottom={reserveBottom}
        showControls={false}
        pixelRatio={pixelRatio}
        onReady={onReady}
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
        {captionStops.map((stop, i) => (
          <div key={i} style={{ marginBottom: i < captionStops.length - 1 ? 22 * scale : 0 }}>
            <p style={{ fontSize: nameSize * scale, fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.02em' }}>
              {stop.name}
            </p>
            {stop.secondary && (
              <p
                style={{
                  fontSize: Math.max(22, Math.round(nameSize * 0.4)) * scale,
                  marginTop: 8 * scale,
                  opacity: 0.82,
                  fontWeight: 500,
                  lineHeight: 1.25,
                }}
              >
                {stop.secondary}
              </p>
            )}
          </div>
        ))}
        {(addedKm != null || totalKm != null) && (
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
            {addedKm != null && addedKm > 0 && (
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
                +{addedKm.toLocaleString()} km
              </span>
            )}
            {totalKm != null && (
              <span style={{ fontSize: 34 * scale, opacity: 0.85, fontWeight: 600 }}>
                {totalKm.toLocaleString()} km total
              </span>
            )}
          </div>
        )}
        </div>
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
  // Per-stop caption overrides (map tag + stacked caption name). Blank/absent falls back to loc.name.
  const [customLabels, setCustomLabels] = useState<Record<string, string>>({});
  // Per-stop comment shown under the name in the caption (e.g. the arrival day + a note). Blank
  // falls back to the stop's arrival date.
  const [customComments, setCustomComments] = useState<Record<string, string>>({});
  const [formatId, setFormatId] = useState(FORMATS[0].id);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [accentColor, setAccentColor] = useState(DEFAULT_ACCENT);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState(false);
  // The full-trip route — calculated ONCE per trip, never on checkbox changes.
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [exporting, setExporting] = useState(false);
  // Rendering and saving are deliberately TWO steps (see handleRender/handleSave): rendering takes
  // seconds, which on iOS Safari outlives the tap's transient user activation — a download or share
  // fired at the end of it is silently ignored. The finished image is parked here and saved by a
  // second, fresh tap.
  const [rendered, setRendered] = useState<{ url: string; blob: Blob; name: string } | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const renderedUrlRef = useRef<string | null>(null);

  // We capture the on-screen preview itself (already loaded, fitted, with markers/route/labels)
  // and upscale it to the target resolution — no hidden second map to race, which is what kept
  // breaking on iOS (blank/unfitted map). What you see in the preview is exactly what exports.
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getTripWithLocations(id).then(({ trip, locations }) => {
      setTrip(trip);
      setLocations(locations);
      setIncluded(new Set());
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

  // Release the last rendered image's object URL when this page goes away.
  useEffect(
    () => () => {
      if (renderedUrlRef.current) URL.revokeObjectURL(renderedUrlRef.current);
    },
    []
  );

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

  // The caption text for a stop: its override if set, otherwise its geocoded name.
  const displayName = (loc: Location) => customLabels[loc.id]?.trim() || loc.name;

  // Day 1 of the trip = its start_date (or, if unset, the earliest stop arrival date).
  const arrivalDates = locations
    .map((l) => l.arrival_date)
    .filter((d): d is string => !!d)
    .sort();
  const tripStart = trip.start_date ?? arrivalDates[0] ?? null;
  const dayNumberFor = (loc: Location): number | null => {
    if (!loc.arrival_date || !tripStart) return null;
    const ms = Date.parse(loc.arrival_date) - Date.parse(tripStart);
    if (Number.isNaN(ms)) return null;
    return Math.floor(ms / 86_400_000) + 1;
  };
  // Default secondary line (used when no comment is typed): "Day N · <date>".
  const defaultSecondary = (loc: Location): string | null => {
    const date = formatDate(loc.arrival_date);
    const day = dayNumberFor(loc);
    if (day == null || day < 1) return date;
    return date ? `Day ${day} · ${date}` : `Day ${day}`;
  };
  // Secondary caption line: the typed comment, else the Day-N/date default, else nothing.
  const commentFor = (loc: Location) => customComments[loc.id]?.trim() || defaultSecondary(loc);

  // Checked stops, in visit order — each becomes an equal-size name block, stacked in the caption.
  const includedList = locations.filter((l) => included.has(l.id));
  const captionStops: CaptionStop[] = includedList.length
    ? includedList.map((l) => ({ name: displayName(l), secondary: commentFor(l) }))
    : [{ name: trip.title, secondary: null }];
  // Shared name size: full-height for one stop, shrinking as more are stacked so they still fit.
  const nameSize =
    captionStops.length <= 1
      ? 88
      : Math.max(40, Math.min(74, Math.round(150 / captionStops.length)));
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

  /** Drop a previously rendered image — anything that changes the picture invalidates it. */
  function clearRendered() {
    if (renderedUrlRef.current) {
      URL.revokeObjectURL(renderedUrlRef.current);
      renderedUrlRef.current = null;
    }
    setRendered(null);
    setExportError(null);
  }

  function toggleStop(locId: string) {
    clearRendered();
    setIncluded((prev) => {
      const next = new Set(prev);
      if (next.has(locId)) next.delete(locId);
      else next.add(locId);
      return next;
    });
  }

  function setAll(on: boolean) {
    clearRendered();
    setIncluded(on ? new Set(locations.map((l) => l.id)) : new Set());
  }

  /** Step 1 — rasterize the preview into a Blob. Slow (seconds), so it does NOT try to save. */
  async function handleRender() {
    if (!trip || !previewRef.current) return;
    clearRendered();
    setExporting(true);
    try {
      // Make sure the web font is loaded so captions don't fall back to a system font.
      if (typeof document !== 'undefined' && 'fonts' in document) {
        try {
          await (document as Document & { fonts: FontFaceSet }).fonts.ready;
        } catch {
          /* fonts.ready unsupported — the explicit sans stacks still keep it off serif */
        }
      }
      // Small settle so the preview map has painted its latest frame before we read its canvas.
      await new Promise((r) => setTimeout(r, 350));

      // The preview renders the stage at FULL export resolution (it's only *displayed* shrunk via
      // a CSS transform on an ancestor), so we capture previewRef 1:1 — MapLibre's own dense detail,
      // small labels, thin route line and normal-size attribution all come through crisply. The
      // ancestor transform doesn't affect the capture: modern-screenshot clones from previewRef
      // down (which has no transform of its own) and honors the explicit width/height.
      //
      // domToBlob, not domToPng: a 1080×1920 PNG as a base64 `data:` URL is several megabytes, and
      // iOS Safari silently refuses to download one that big. A Blob + object URL has no such limit.
      const blob = await domToBlob(previewRef.current, {
        width: format.width,
        height: format.height,
        scale: 1,
        type: 'image/png',
        // Fill behind the stage's tiny rounded corners so they don't export as transparent notches.
        backgroundColor: theme === 'dark' ? '#000000' : '#ffffff',
        // Wait for web fonts to be embedded so the caption never falls back to a system font.
        font: {},
      });
      const url = URL.createObjectURL(blob);
      renderedUrlRef.current = url;
      setRendered({
        url,
        blob,
        name: `${slugify(trip.title)}-${includedList.length}stops-${format.width}x${format.height}.png`,
      });
    } catch (err) {
      // Previously this path had no catch at all, so a failed capture just reset the button and
      // looked like "nothing happened". Surface it instead.
      setExportError(err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(false);
    }
  }

  /** Step 2 — save the already-rendered Blob. Runs inside a fresh tap, so iOS still trusts it.
   *  Must not `await` anything before navigator.share(): an await drops the user activation. */
  function handleSave() {
    if (!rendered) return;
    const file = new File([rendered.blob], rendered.name, { type: 'image/png' });

    // iOS has no real "download": the share sheet ("Save Image") is the native way into Photos.
    if (isIOS() && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: rendered.name }).catch(() => {
        /* user dismissed the sheet, or share refused — the image is still on screen to long-press */
      });
      return;
    }

    // Everywhere else: a normal object-URL download. The anchor must be in the document for
    // Firefox to honour the click.
    const link = document.createElement('a');
    link.href = rendered.url;
    link.download = rendered.name;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
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
              The whole trip is always shown — tick the stops to feature. Featured stops get a name
              label, stack equally in the caption, and count toward the “+km added”. Edit each
              featured stop’s name and add a comment (arrival day, a note) inline.
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
                  <div className="max-h-80 space-y-1 overflow-y-auto rounded-xl border border-border/60 p-1">
                    {/* Displayed latest-stop-first (reversed), but the number badge still shows
                        each stop's true visit order (1 = trip start). */}
                    {locations
                      .map((loc, i) => ({ loc, num: i + 1 }))
                      .reverse()
                      .map(({ loc, num }) => {
                      const on = included.has(loc.id);
                      const custom = customLabels[loc.id] ?? '';
                      const comment = customComments[loc.id] ?? '';
                      return (
                        <div
                          key={loc.id}
                          className={`rounded-lg px-1.5 py-1 transition-colors ${
                            on ? 'bg-primary/5' : 'opacity-55 hover:opacity-100'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => toggleStop(loc.id)}
                              className="flex shrink-0 items-center gap-2"
                              title={
                                on ? 'Featured — click to hide its label' : 'Click to feature this stop'
                              }
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
                                {num}.
                              </span>
                            </button>
                            <input
                              value={custom}
                              placeholder={loc.name}
                              onChange={(e) =>
                                setCustomLabels((prev) => ({ ...prev, [loc.id]: e.target.value }))
                              }
                              className="min-w-0 flex-1 rounded-md bg-transparent px-1.5 py-1 text-sm outline-none placeholder:text-muted-foreground/70 focus:bg-background focus:ring-1 focus:ring-ring"
                            />
                            {custom.trim() && (
                              <button
                                type="button"
                                onClick={() =>
                                  setCustomLabels((prev) => {
                                    const next = { ...prev };
                                    delete next[loc.id];
                                    return next;
                                  })
                                }
                                className="shrink-0 text-muted-foreground/50 transition-colors hover:text-foreground"
                                title="Reset to original name"
                              >
                                <RotateCcw size={13} />
                              </button>
                            )}
                          </div>
                          {on && (
                            <input
                              value={comment}
                              placeholder={
                                defaultSecondary(loc)
                                  ? `Comment (default: ${defaultSecondary(loc)})`
                                  : 'Comment — arrival day, a note…'
                              }
                              onChange={(e) =>
                                setCustomComments((prev) => ({ ...prev, [loc.id]: e.target.value }))
                              }
                              className="mt-1 ml-[26px] w-[calc(100%-26px)] rounded-md bg-transparent px-1.5 py-1 text-xs text-muted-foreground outline-none placeholder:text-muted-foreground/50 focus:bg-background focus:text-foreground focus:ring-1 focus:ring-ring"
                            />
                          )}
                        </div>
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
                </div>

                {/* Two steps on purpose. Rendering takes seconds; on iOS Safari a download or
                    share fired after that delay has outlived the tap's user activation and is
                    silently dropped (which is exactly how this used to fail — "click, flash,
                    nothing"). The save below runs on its own fresh tap. */}
                <Button
                  className="w-full gap-2"
                  disabled={exporting || routeLoading}
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
                      alt={`${trip.title} export preview`}
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
            {/* The preview renders the stage at FULL export resolution (so MapLibre draws its
                native dense detail, small labels, thin route line and a normal-size attribution)
                and is only *displayed* shrunk to fit the panel via a CSS transform on the scaler
                below. previewRef wraps the un-transformed full-size element — the exact capture
                source in handleExport (grabbed 1:1). WYSIWYG. */}
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
                    locations={locations}
                    labeledIds={labeledIds}
                    labelOverrides={customLabels}
                    routeGeometry={routeGeometry}
                    accentColor={accentColor}
                    theme={theme}
                    captionStops={captionStops}
                    nameSize={nameSize}
                    addedKm={addedKm}
                    totalKm={totalKm}
                    pixelRatio={1}
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
