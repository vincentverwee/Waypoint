'use client';

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Location } from '@/types';
import { TRIP_COLORS } from '@/lib/tripColors';

const ROUTE_SOURCE_ID = 'route';
const ROUTE_LAYER_ID = 'route-line';
const DOTS_SOURCE_ID = 'stop-dots';
const DOTS_LAYER_ID = 'stop-dots-layer';
// Nested-band widths for overlapping trip routes: each trip gets a distinct line width so that
// where routes share a road they nest inside one another (all centered on the road, no offset →
// no warping) and every trip's color stays visible. Widest is drawn first (underneath).
const ROUTE_WIDTH_TOP = 3; // narrowest, drawn on top (innermost visible band)
const ROUTE_WIDTH_STEP = 3; // width added per rank below the top
const ROUTE_WIDTH_MAX = 15; // cap so many trips don't produce an absurdly fat base line
const SINGLE_ROUTE_WIDTH = 4; // single-trip views / exports keep the original constant width

// Explicit font stack for markers + labels. html2canvas can capture before the app's web font
// (Inter) is ready, in which case it falls back to the browser default — serif — which is what
// made the exported labels/headline look like Times. A concrete sans stack keeps them sans even
// if Inter isn't captured. (The export page also awaits document.fonts.ready before capturing.)
const SANS_STACK =
  "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

// Fallback trip color when the caller doesn't supply an explicit `tripColors` map (which assigns
// distinct hues per trip). Hashing the id can collide, so prefer passing `tripColors`.
export function colorForTrip(tripId: string) {
  let hash = 0;
  for (let i = 0; i < tripId.length; i++) hash = (hash * 31 + tripId.charCodeAt(i)) | 0;
  return TRIP_COLORS[Math.abs(hash) % TRIP_COLORS.length];
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function buildPopupContent(loc: Location, label: string) {
  const wrapper = document.createElement('div');
  wrapper.className = 'space-y-1 text-sm';

  const title = document.createElement('p');
  title.className = 'font-semibold';
  title.textContent = label ? `${label} · ${loc.name}` : loc.name;
  wrapper.appendChild(title);

  const dateLabel = [formatDate(loc.arrival_date), formatDate(loc.departure_date)]
    .filter(Boolean)
    .join(' – ');
  if (dateLabel) {
    const dateEl = document.createElement('p');
    dateEl.className = 'text-xs text-muted-foreground';
    dateEl.textContent = dateLabel;
    wrapper.appendChild(dateEl);
  }

  if (loc.notes) {
    const notesEl = document.createElement('p');
    notesEl.className = 'text-xs';
    notesEl.textContent = loc.notes;
    wrapper.appendChild(notesEl);
  }

  return wrapper;
}

interface TripRoute {
  tripId: string;
  geometry: GeoJSON.LineString;
}

// Marker/label sizing is expressed for a 1080px-wide canvas (the export design width) and
// scaled down for the small on-screen preview, so both look proportionally identical.
const DESIGN_MAP_WIDTH = 1080;
const DOT_AT_DESIGN = 48;
const LABEL_FONT_AT_DESIGN = 36;

interface LabelItem {
  loc: Location;
  el: HTMLDivElement;
  line: SVGLineElement;
  w: number;
  h: number;
}

/** Greedy leader-line label placement: keeps every label on-screen and clear of other labels,
 *  the marker dots, and the route line — trying 8 directions around its dot at growing distances,
 *  and drawing a connector line whenever the label ends up displaced from its marker. Falls back
 *  to the least-covering spot when nothing is fully clear. */
function layoutLabels(
  map: maplibregl.Map,
  items: LabelItem[],
  W: number,
  H: number,
  dotRadius: number,
  bottomInset: number,
  markerLngLats: [number, number][],
  routeLngLats: [number, number][]
) {
  const maxY = H - 4 - bottomInset;
  const margin = Math.max(4, dotRadius * 0.4);
  const gap = dotRadius + margin;
  const placed: { x: number; y: number; w: number; h: number }[] = [];

  // Project the obstacle geometry with the *current* view: markers as keep-out circles, and the
  // route sampled to screen points (OSRM geometry is dense, so point sampling covers the line).
  const markerPts = markerLngLats.map((ll) => map.project(ll));
  const routePts: { x: number; y: number }[] = [];
  const step = Math.max(1, Math.ceil(routeLngLats.length / 400));
  for (let i = 0; i < routeLngLats.length; i += step) routePts.push(map.project(routeLngLats[i]));
  const markerKeepout = dotRadius + margin;

  const anchored = items
    .map((it) => {
      const p = map.project([it.loc.longitude, it.loc.latitude]);
      return { it, ax: p.x, ay: p.y };
    })
    .sort((a, b) => a.ay - b.ay || a.ax - b.ax);

  const intersects = (
    a: { x: number; y: number; w: number; h: number },
    b: { x: number; y: number; w: number; h: number }
  ) =>
    a.x < b.x + b.w + margin &&
    a.x + a.w + margin > b.x &&
    a.y < b.y + b.h + margin &&
    a.y + a.h + margin > b.y;

  // Does rect cover a point within radius r? (rect–circle test via nearest point on the rect.)
  const hitsPoint = (
    rect: { x: number; y: number; w: number; h: number },
    px: number,
    py: number,
    r: number
  ) => {
    const nx = Math.min(Math.max(px, rect.x), rect.x + rect.w);
    const ny = Math.min(Math.max(py, rect.y), rect.y + rect.h);
    return (nx - px) ** 2 + (ny - py) ** 2 < r * r;
  };

  // Candidate cost: overlapping another label weighs most, then covering a marker, then the route.
  const penalty = (rect: { x: number; y: number; w: number; h: number }) => {
    let p = 0;
    for (const q of placed) if (intersects(rect, q)) p += 1000;
    for (const m of markerPts) if (hitsPoint(rect, m.x, m.y, markerKeepout)) p += 100;
    for (const r of routePts) if (hitsPoint(rect, r.x, r.y, margin)) p += 6;
    return p;
  };

  for (const { it, ax, ay } of anchored) {
    const { w, h } = it;
    const candidates: { x: number; y: number }[] = [];
    for (let ring = 0; ring < 12; ring++) {
      const off = gap + ring * Math.max(h, 28);
      const diag = off * 0.7071;
      candidates.push({ x: ax - w / 2, y: ay + off }); // below
      candidates.push({ x: ax - w / 2, y: ay - off - h }); // above
      candidates.push({ x: ax + off, y: ay - h / 2 }); // right
      candidates.push({ x: ax - off - w, y: ay - h / 2 }); // left
      candidates.push({ x: ax + diag, y: ay + diag }); // down-right
      candidates.push({ x: ax - diag - w, y: ay + diag }); // down-left
      candidates.push({ x: ax + diag, y: ay - diag - h }); // up-right
      candidates.push({ x: ax - diag - w, y: ay - diag - h }); // up-left
    }

    let chosen = {
      x: Math.min(Math.max(candidates[0].x, 4), W - w - 4),
      y: Math.min(Math.max(candidates[0].y, 4), maxY - h),
    };
    let best = Infinity;
    for (const c of candidates) {
      const rect = {
        x: Math.min(Math.max(c.x, 4), W - w - 4),
        y: Math.min(Math.max(c.y, 4), maxY - h),
        w,
        h,
      };
      const pen = penalty(rect);
      if (pen < best) {
        best = pen;
        chosen = { x: rect.x, y: rect.y };
        if (pen === 0) break;
      }
    }

    const x = Math.min(Math.max(chosen.x, 4), W - w - 4);
    const y = Math.min(Math.max(chosen.y, 4), maxY - h);
    placed.push({ x, y, w, h });
    // Position with left/top, NOT transform:translate. html2canvas (the export renderer)
    // applies CSS transforms inconsistently to a box vs its border, which detached the accent
    // border from the pill body in the export. left/top is its most reliably-handled path.
    it.el.style.left = `${x}px`;
    it.el.style.top = `${y}px`;

    // Connector line from the dot's edge to the nearest point on the label box (skip if the
    // label still sits right over its marker).
    const cx = Math.min(Math.max(ax, x), x + w);
    const cy = Math.min(Math.max(ay, y), y + h);
    const dist = Math.hypot(cx - ax, cy - ay);
    if (dist > dotRadius + 3) {
      const sx = ax + ((cx - ax) / dist) * dotRadius;
      const sy = ay + ((cy - ay) / dist) * dotRadius;
      it.line.setAttribute('x1', String(sx));
      it.line.setAttribute('y1', String(sy));
      it.line.setAttribute('x2', String(cx));
      it.line.setAttribute('y2', String(cy));
      it.line.style.display = '';
    } else {
      it.line.style.display = 'none';
    }
  }
}

interface MapViewProps {
  locations?: Location[];
  /** Single-trip route line (trip detail page). For multiple trips at once, use `routes` instead. */
  routeGeometry?: GeoJSON.LineString | null;
  /** One route line per trip, each colored to match that trip's markers (dashboard, world map). */
  routes?: TripRoute[];
  /** Optional label shown per-marker, e.g. the trip title when plotting multiple trips together. */
  tripLabels?: Record<string, string>;
  /** Explicit per-trip color map (distinct hue per trip). Takes precedence over the hashed
   *  `colorForTrip` fallback; drives markers/dots and route-line color so they always match. */
  tripColors?: Record<string, string>;
  /** How to mark each stop:
   *  - `'numbered'` (default): the big numbered pins — single-trip views + exports.
   *  - `'dot'`: small trip-colored dots (no numbers) — the dashboard's combined multi-trip map,
   *    where overlapping numbered pins got cluttered.
   *  - `'none'`: no stop markers at all. */
  markerStyle?: 'numbered' | 'dot' | 'none';
  /** Overrides per-trip marker/route coloring with one fixed color — for single-trip exports. */
  accentColor?: string;
  /** Renders each marker's name as a permanently visible tag instead of only in a click popup — for exports. */
  showLabels?: boolean;
  /** When set, only markers whose location id is listed get a name tag (overrides `showLabels`).
   *  Lets the export show the whole trip but label only the featured stops. */
  labeledIds?: string[];
  /** Per-location override for the text shown on a marker's name tag. Falls back to `loc.name`
   *  when absent/blank. Lets the export caption each featured stop with custom wording. */
  labelOverrides?: Record<string, string>;
  /** Pixels to keep clear at the bottom of the canvas (the export's caption scrim). Drives both
   *  the fit-bounds bottom padding and the label keep-out zone. Falls back to ~32% of height. */
  reserveBottom?: number;
  /** Show the zoom/compass control. Off for exports so it doesn't appear in the captured image. */
  showControls?: boolean;
  /** Forces the WebGL canvas' pixel ratio instead of the device default. The export/capture map
   *  passes `1` so its buffer equals the (already full-resolution) container — a 1920px container
   *  at the phone's devicePixelRatio 2–3 would otherwise blow past iOS's ~4096px WebGL canvas limit
   *  and render only a partial strip. */
  pixelRatio?: number;
  /** Fires on the map's `idle` event after the latest markers/route/fit have painted — the export
   *  page awaits this before capturing the full-resolution map. */
  onReady?: () => void;
}

export default function MapView({
  locations = [],
  routeGeometry = null,
  routes,
  tripLabels,
  tripColors,
  markerStyle = 'numbered',
  accentColor,
  showLabels = false,
  labeledIds,
  labelOverrides,
  reserveBottom,
  showControls = true,
  pixelRatio,
  onReady,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const onReadyRef = useRef(onReady);
  // Label overlay: a div (name tags) + svg (leader lines) layered above the map canvas.
  const labelOverlayRef = useRef<HTMLDivElement | null>(null);
  const labelSvgRef = useRef<SVGSVGElement | null>(null);
  const labelItemsRef = useRef<LabelItem[]>([]);
  const labelRenderHandlerRef = useRef<(() => void) | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [4.4, 50.85],
      zoom: 5,
      // Without this, WebGL discards its drawing buffer after each compositor swap, so a
      // later modern-screenshot capture (export page) can sample a blank frame from the canvas.
      preserveDrawingBuffer: true,
      // Cap the buffer for the export map (passes 1) so it stays within iOS's WebGL canvas limit.
      ...(pixelRatio != null ? { pixelRatio } : {}),
    });
    if (showControls) map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.on('load', () => {
      // In dev, React Strict Mode mounts/cleans up/remounts this effect; guard against a
      // stale map's late 'load' event marking a since-replaced instance as ready.
      if (mapRef.current === map) setLoaded(true);
    });
    mapRef.current = map;

    // Overlay for name tags + leader lines, layered above the map canvas. Pointer-events off
    // so it never blocks marker clicks. (.maplibregl-map is position:relative, so inset-0 aligns.)
    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:absolute;inset:0;z-index:3;pointer-events:none;overflow:hidden;';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;overflow:visible;';
    overlay.appendChild(svg);
    containerRef.current.appendChild(overlay);
    labelOverlayRef.current = overlay;
    labelSvgRef.current = svg;

    // Keeps the canvas in sync when its container is resized (e.g. a responsive
    // breakpoint change, or the export page growing the container to full export size).
    const resizeObserver = new ResizeObserver(() => {
      mapRef.current?.resize();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      overlay.remove();
      labelOverlayRef.current = null;
      labelSvgRef.current = null;
      labelItemsRef.current = [];
      map.remove();
      mapRef.current = null;
      setLoaded(false);
    };
  }, [showControls, pixelRatio]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;

    // Marker + label sizing scales with the canvas width so the full-resolution export
    // gets big markers/labels while the small preview stays proportional.
    const mapW = containerRef.current?.clientWidth ?? DESIGN_MAP_WIDTH;
    const s = mapW / DESIGN_MAP_WIDTH;
    const dotSize = Math.max(20, Math.round(DOT_AT_DESIGN * s));
    const dotRadius = dotSize / 2;
    const numFont = Math.max(10, Math.round(dotSize * 0.45));
    const labelFont = Math.max(11, Math.round(LABEL_FONT_AT_DESIGN * s));

    // Per-trip color: an explicit map wins (distinct hues), else the hashed fallback, else the
    // single-trip default. Shared by numbered pins, dots and route lines so they always match.
    const resolveColor = (tripId: string) =>
      accentColor ?? tripColors?.[tripId] ?? (tripLabels ? colorForTrip(tripId) : '#4f46e5');

    // Number each marker by its position within its own trip (visit_order), not by
    // position in the combined array — otherwise markers from multiple trips plotted
    // together (dashboard, world map) number straight through instead of restarting per trip.
    const orderedLocations = [...locations].sort((a, b) =>
      a.trip_id === b.trip_id ? a.visit_order - b.visit_order : a.trip_id.localeCompare(b.trip_id)
    );
    const seenPerTrip = new Map<string, number>();

    markersRef.current.forEach((m) => m.remove());
    markersRef.current =
      markerStyle === 'numbered'
      ? orderedLocations.map((loc) => {
          const number = (seenPerTrip.get(loc.trip_id) ?? 0) + 1;
          seenPerTrip.set(loc.trip_id, number);

          const color = resolveColor(loc.trip_id);
          const el = document.createElement('div');
          // NOTE: don't set `position` here — MapLibre's `.maplibregl-marker` class positions the
          // element absolutely and drives it via `transform`. An inline `position` overrides that
          // class and makes every marker fall back into normal flow (they pile up / land off-target).
          const borderW = Math.max(2, Math.round(3 * s));
          // NOTE: no flexbox here. html2canvas (used by the export) doesn't implement flex centering
          // and blows a width-less flex box up to its parent's width — which is exactly what made the
          // exported labels stretch edge-to-edge. Center the digit with line-height + text-align.
          // line-height must equal the *content* height (dot minus the two borders) — using the full
          // border-box height leaves the line box taller than the content and the digit sits low.
          const innerH = dotSize - 2 * borderW;
          el.style.cssText = `box-sizing:border-box;display:block;width:${dotSize}px;height:${dotSize}px;border-radius:9999px;border:${borderW}px solid white;background:${color};color:white;font-family:${SANS_STACK};font-size:${numFont}px;font-weight:700;line-height:${innerH}px;text-align:center;box-shadow:0 ${Math.max(1, Math.round(2 * s))}px ${Math.max(3, Math.round(6 * s))}px rgba(0,0,0,0.35);cursor:pointer;`;
          el.textContent = String(number);

          const label = tripLabels?.[loc.trip_id] ?? '';
          return new maplibregl.Marker({ element: el })
            .setLngLat([loc.longitude, loc.latitude])
            .setPopup(
              new maplibregl.Popup({ offset: 16 }).setDOMContent(buildPopupContent(loc, label))
            )
            .addTo(map);
        })
      : [];

    // Name tags live in a separate overlay (not glued under each dot) so they can be laid out
    // to never overlap, with a leader line back to the marker when displaced.
    if (labelRenderHandlerRef.current) {
      map.off('render', labelRenderHandlerRef.current);
      labelRenderHandlerRef.current = null;
    }
    labelItemsRef.current.forEach((it) => {
      it.el.remove();
      it.line.remove();
    });
    labelItemsRef.current = [];

    const labeledLocs = orderedLocations.filter((loc) =>
      labeledIds ? labeledIds.includes(loc.id) : showLabels
    );
    const overlay = labelOverlayRef.current;
    const svg = labelSvgRef.current;
    if (overlay && svg && labeledLocs.length > 0) {
      const padY = Math.round(labelFont * 0.42);
      const padX = Math.round(labelFont * 0.75);
      const radius = Math.round(labelFont * 0.7);
      const lineColor = accentColor ?? '#4f46e5';
      const dotColor = accentColor ?? '#4f46e5';
      labelItemsRef.current = labeledLocs.map((loc) => {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('stroke', lineColor);
        line.setAttribute('stroke-width', String(Math.max(2, 3.5 * s)));
        line.setAttribute('stroke-linecap', 'round');
        line.style.display = 'none';
        svg.appendChild(line);

        const el = document.createElement('div');
        el.textContent = labelOverrides?.[loc.id]?.trim() || loc.name;
        // Pill styling kept deliberately html2canvas-safe (the export renderer):
        //  - display:inline-block + a pinned px width (set in place()) — NOT flex and NOT auto —
        //    because html2canvas renders width-less positioned boxes at full parent width.
        //  - a solid all-round border instead of box-shadow / border-left: html2canvas turns
        //    box-shadows into gray gradient bands and mis-places one-sided borders.
        const borderW = Math.max(2, Math.round(3 * s));
        el.style.cssText = `position:absolute;left:0;top:0;box-sizing:border-box;display:inline-block;white-space:nowrap;font-family:${SANS_STACK};font-size:${labelFont}px;font-weight:700;line-height:1.2;letter-spacing:-0.01em;text-align:center;color:#0f172a;background:#ffffff;padding:${padY}px ${padX}px;border-radius:${radius}px;border:${borderW}px solid ${dotColor};`;
        overlay.appendChild(el);
        // offsetWidth/Height, NOT getBoundingClientRect: the export capture stage is displayed
        // under a CSS `transform: scale()` (to keep the full-res map on-screen so iOS composites
        // it), which scales getBoundingClientRect but not offsetWidth — so offset* gives the true
        // untransformed 1080/1920-space size the overlay math needs.
        return { loc, el, line, w: el.offsetWidth, h: el.offsetHeight };
      });

      // Obstacle geometry for label placement (avoid covering markers + the route line). Kept as
      // lng/lat here and projected fresh inside layoutLabels on every render (the view can pan/zoom).
      const markerLngLats: [number, number][] = orderedLocations.map((l) => [l.longitude, l.latitude]);
      const routeLngLats: [number, number][] = routes?.length
        ? routes.flatMap((r) => r.geometry.coordinates as [number, number][])
        : routeGeometry
          ? (routeGeometry.coordinates as [number, number][])
          : [];

      const isExportLabels = showLabels || labeledIds != null;
      const place = () => {
        const m = mapRef.current;
        const ov = labelOverlayRef.current;
        if (!m || !ov) return;
        const W = ov.clientWidth;
        const H = ov.clientHeight;
        svg.setAttribute('width', String(W));
        svg.setAttribute('height', String(H));
        // Re-measure each pill against its natural (auto) width, then pin that exact width in px.
        // Two reasons: (1) the web font can finish loading after the pills were created, changing
        // their size; (2) html2canvas doesn't compute shrink-to-fit width for absolutely-positioned
        // boxes and would otherwise render them at full parent width (the edge-to-edge stretch).
        for (const it of labelItemsRef.current) {
          it.el.style.width = 'auto';
          // offsetWidth/Height (untransformed layout size) — see the note where these pills are
          // created: the capture stage renders under a `transform: scale()` on iOS.
          const w = it.el.offsetWidth;
          it.el.style.width = `${w}px`;
          it.w = w;
          it.h = it.el.offsetHeight;
        }
        const bottomInset = isExportLabels ? (reserveBottom ?? Math.round(H * 0.32) + 40) : 0;
        layoutLabels(m, labelItemsRef.current, W, H, dotRadius, bottomInset, markerLngLats, routeLngLats);
      };

      let rafPending = false;
      const onRender = () => {
        if (rafPending) return;
        rafPending = true;
        requestAnimationFrame(() => {
          rafPending = false;
          place();
        });
      };
      map.on('render', onRender);
      labelRenderHandlerRef.current = onRender;
      place();
    }

    // Routes stay at their TRUE position (no perpendicular offset — that warped lines off the roads
    // at low zoom). To keep every trip visible where routes overlap, give each route a distinct
    // width so they nest: the widest is drawn first (underneath) and the narrowest on top, all
    // centered on the road, so a shared road reads as one line with the colors nested across it.
    const rankedRoutes = routes?.length
      ? routes.map((r, i) => ({
          color: resolveColor(r.tripId),
          geometry: r.geometry,
          width: Math.min(ROUTE_WIDTH_MAX, ROUTE_WIDTH_TOP + (routes.length - 1 - i) * ROUTE_WIDTH_STEP),
        }))
      : [];
    const routeFeatures: GeoJSON.Feature[] = routes?.length
      ? // widest first → drawn underneath; narrowest last → drawn on top (innermost band)
        [...rankedRoutes]
          .sort((a, b) => b.width - a.width)
          .map((r) => ({
            type: 'Feature',
            // opacity 1 so nested bands show crisp colors instead of muddy blends
            properties: { color: r.color, width: r.width, opacity: 1 },
            geometry: r.geometry,
          }))
      : routeGeometry
        ? [
            {
              type: 'Feature',
              properties: { color: accentColor ?? '#4f46e5', width: SINGLE_ROUTE_WIDTH, opacity: 0.9 },
              geometry: routeGeometry,
            },
          ]
        : [];

    const existingSource = map.getSource(ROUTE_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    const collection: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: routeFeatures };
    if (routeFeatures.length > 0) {
      if (existingSource) {
        existingSource.setData(collection);
      } else {
        map.addSource(ROUTE_SOURCE_ID, { type: 'geojson', data: collection });
        map.addLayer({
          id: ROUTE_LAYER_ID,
          type: 'line',
          source: ROUTE_SOURCE_ID,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': ['get', 'color'],
            'line-width': ['get', 'width'],
            'line-opacity': ['get', 'opacity'],
          },
        });
      }
    } else if (existingSource) {
      if (map.getLayer(ROUTE_LAYER_ID)) map.removeLayer(ROUTE_LAYER_ID);
      map.removeSource(ROUTE_SOURCE_ID);
    }

    // Small trip-colored stop dots (markerStyle 'dot' — the dashboard's decluttered multi-trip map).
    // A circle layer (not DOM markers) so many stops stay cheap; drawn above the route lines.
    const dotFeatures: GeoJSON.Feature[] =
      markerStyle === 'dot'
        ? orderedLocations.map((loc) => ({
            type: 'Feature',
            properties: { color: resolveColor(loc.trip_id) },
            geometry: { type: 'Point', coordinates: [loc.longitude, loc.latitude] },
          }))
        : [];
    const existingDots = map.getSource(DOTS_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    const dotCollection: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: dotFeatures };
    if (dotFeatures.length > 0) {
      if (existingDots) {
        existingDots.setData(dotCollection);
      } else {
        map.addSource(DOTS_SOURCE_ID, { type: 'geojson', data: dotCollection });
        map.addLayer({
          id: DOTS_LAYER_ID,
          type: 'circle',
          source: DOTS_SOURCE_ID,
          paint: {
            // Grow slightly with zoom so dots read at both the continent and city scale.
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 3, 8, 5.5],
            'circle-color': ['get', 'color'],
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#ffffff',
          },
        });
      }
    } else if (existingDots) {
      if (map.getLayer(DOTS_LAYER_ID)) map.removeLayer(DOTS_LAYER_ID);
      map.removeSource(DOTS_SOURCE_ID);
    }

    if (locations.length > 0) {
      const bounds = locations.reduce(
        (b, loc) => b.extend([loc.longitude, loc.latitude]),
        new maplibregl.LngLatBounds(
          [locations[0].longitude, locations[0].latitude],
          [locations[0].longitude, locations[0].latitude]
        )
      );
      // In export mode the bottom of the image is covered by the text scrim, so reserve
      // extra bottom padding to keep the markers and their name tags above it.
      const isExport = showLabels || labeledIds != null;
      const height = containerRef.current?.clientHeight ?? 0;
      const padding = isExport
        ? { top: 70, left: 70, right: 70, bottom: reserveBottom ?? Math.round(height * 0.32) + 40 }
        : 60;
      map.fitBounds(bounds, { padding, maxZoom: 12, duration: isExport ? 0 : 500 });
    }

    // Export path only: signal when the freshly-fitted map has finished painting so the
    // capture happens against the real view, not the default center/zoom (the earlier bug).
    if (onReadyRef.current) {
      const cb = onReadyRef.current;
      map.once('idle', () => cb());
    }
  }, [locations, routeGeometry, routes, tripLabels, tripColors, markerStyle, accentColor, showLabels, labeledIds, labelOverrides, reserveBottom, loaded]);

  return <div ref={containerRef} className="h-full w-full rounded-2xl" />;
}
