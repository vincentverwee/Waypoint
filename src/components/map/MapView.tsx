'use client';

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Location } from '@/types';

const ROUTE_SOURCE_ID = 'route';
const ROUTE_LAYER_ID = 'route-line';

const MARKER_COLORS = ['#4f46e5', '#0ea5e9', '#f59e0b', '#ef4444', '#10b981', '#a855f7'];

export function colorForTrip(tripId: string) {
  let hash = 0;
  for (let i = 0; i < tripId.length; i++) hash = (hash * 31 + tripId.charCodeAt(i)) | 0;
  return MARKER_COLORS[Math.abs(hash) % MARKER_COLORS.length];
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
const DOT_AT_DESIGN = 30;
const LABEL_FONT_AT_DESIGN = 26;

interface LabelItem {
  loc: Location;
  el: HTMLDivElement;
  line: SVGLineElement;
  w: number;
  h: number;
}

/** Greedy leader-line label placement: keeps every label on-screen and non-overlapping,
 *  trying below/above/right/left of its dot at growing distances, and drawing a connector
 *  line whenever the label ends up displaced from directly under its marker. */
function layoutLabels(
  map: maplibregl.Map,
  items: LabelItem[],
  W: number,
  H: number,
  dotRadius: number,
  bottomInset: number
) {
  const maxY = H - 4 - bottomInset;
  const margin = Math.max(4, dotRadius * 0.4);
  const gap = dotRadius + margin;
  const placed: { x: number; y: number; w: number; h: number }[] = [];

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

  for (const { it, ax, ay } of anchored) {
    const { w, h } = it;
    const candidates: { x: number; y: number }[] = [];
    for (let ring = 0; ring < 10; ring++) {
      const off = gap + ring * (h + 6);
      candidates.push({ x: ax - w / 2, y: ay + off }); // below
      candidates.push({ x: ax - w / 2, y: ay - off - h }); // above
      candidates.push({ x: ax + off, y: ay - h / 2 }); // right
      candidates.push({ x: ax - off - w, y: ay - h / 2 }); // left
    }

    let chosen = candidates[0];
    for (const c of candidates) {
      const rect = {
        x: Math.min(Math.max(c.x, 4), W - w - 4),
        y: Math.min(Math.max(c.y, 4), maxY - h),
        w,
        h,
      };
      if (!placed.some((p) => intersects(rect, p))) {
        chosen = { x: rect.x, y: rect.y };
        break;
      }
      chosen = { x: rect.x, y: rect.y };
    }

    const x = Math.min(Math.max(chosen.x, 4), W - w - 4);
    const y = Math.min(Math.max(chosen.y, 4), maxY - h);
    placed.push({ x, y, w, h });
    it.el.style.transform = `translate(${x}px, ${y}px)`;

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
  /** Overrides per-trip marker/route coloring with one fixed color — for single-trip exports. */
  accentColor?: string;
  /** Renders each marker's name as a permanently visible tag instead of only in a click popup — for exports. */
  showLabels?: boolean;
  /** When set, only markers whose location id is listed get a name tag (overrides `showLabels`).
   *  Lets the export show the whole trip but label only the featured stops. */
  labeledIds?: string[];
  /** Show the zoom/compass control. Off for exports so it doesn't appear in the captured image. */
  showControls?: boolean;
  /** Fires on the map's `idle` event after the latest markers/route/fit have painted — the export
   *  page awaits this before capturing the off-screen full-resolution map. */
  onReady?: () => void;
}

export default function MapView({
  locations = [],
  routeGeometry = null,
  routes,
  tripLabels,
  accentColor,
  showLabels = false,
  labeledIds,
  showControls = true,
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
      // later html2canvas capture (export page) can sample a blank frame from the canvas.
      preserveDrawingBuffer: true,
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
  }, [showControls]);

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

    // Number each marker by its position within its own trip (visit_order), not by
    // position in the combined array — otherwise markers from multiple trips plotted
    // together (dashboard, world map) number straight through instead of restarting per trip.
    const orderedLocations = [...locations].sort((a, b) =>
      a.trip_id === b.trip_id ? a.visit_order - b.visit_order : a.trip_id.localeCompare(b.trip_id)
    );
    const seenPerTrip = new Map<string, number>();

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = orderedLocations.map((loc) => {
      const number = (seenPerTrip.get(loc.trip_id) ?? 0) + 1;
      seenPerTrip.set(loc.trip_id, number);

      const color = accentColor ?? (tripLabels ? colorForTrip(loc.trip_id) : '#4f46e5');
      const el = document.createElement('div');
      // NOTE: don't set `position` here — MapLibre's `.maplibregl-marker` class positions the
      // element absolutely and drives it via `transform`. An inline `position` overrides that
      // class and makes every marker fall back into normal flow (they pile up / land off-target).
      el.style.cssText = `display:flex;align-items:center;justify-content:center;width:${dotSize}px;height:${dotSize}px;border-radius:9999px;border:2px solid white;background:${color};color:white;font-size:${numFont}px;font-weight:700;box-shadow:0 1px 4px rgba(0,0,0,0.35);cursor:pointer;`;
      el.textContent = String(number);

      const label = tripLabels?.[loc.trip_id] ?? '';
      return new maplibregl.Marker({ element: el })
        .setLngLat([loc.longitude, loc.latitude])
        .setPopup(new maplibregl.Popup({ offset: 16 }).setDOMContent(buildPopupContent(loc, label)))
        .addTo(map);
    });

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
      const pad = Math.round(labelFont * 0.35);
      const radius = Math.round(labelFont * 0.45);
      const lineColor = accentColor ?? '#4f46e5';
      labelItemsRef.current = labeledLocs.map((loc) => {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('stroke', lineColor);
        line.setAttribute('stroke-width', String(Math.max(1.5, 3 * s)));
        line.setAttribute('stroke-linecap', 'round');
        line.style.display = 'none';
        svg.appendChild(line);

        const el = document.createElement('div');
        el.textContent = loc.name;
        el.style.cssText = `position:absolute;left:0;top:0;will-change:transform;white-space:nowrap;font-size:${labelFont}px;font-weight:700;line-height:1.15;color:#111;background:rgba(255,255,255,0.96);padding:${pad}px ${pad * 2}px;border-radius:${radius}px;box-shadow:0 1px 4px rgba(0,0,0,0.3);`;
        overlay.appendChild(el);
        const rect = el.getBoundingClientRect();
        return { loc, el, line, w: rect.width, h: rect.height };
      });

      const isExportLabels = showLabels || labeledIds != null;
      const place = () => {
        const m = mapRef.current;
        const ov = labelOverlayRef.current;
        if (!m || !ov) return;
        const W = ov.clientWidth;
        const H = ov.clientHeight;
        svg.setAttribute('width', String(W));
        svg.setAttribute('height', String(H));
        const bottomInset = isExportLabels ? Math.round(H * 0.32) + 40 : 0;
        layoutLabels(m, labelItemsRef.current, W, H, dotRadius, bottomInset);
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

    const routeFeatures: GeoJSON.Feature[] = routes?.length
      ? routes.map((r) => ({
          type: 'Feature',
          properties: { color: accentColor ?? (tripLabels ? colorForTrip(r.tripId) : '#4f46e5') },
          geometry: r.geometry,
        }))
      : routeGeometry
        ? [{ type: 'Feature', properties: { color: accentColor ?? '#4f46e5' }, geometry: routeGeometry }]
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
          paint: { 'line-color': ['get', 'color'], 'line-width': 4, 'line-opacity': 0.85 },
        });
      }
    } else if (existingSource) {
      if (map.getLayer(ROUTE_LAYER_ID)) map.removeLayer(ROUTE_LAYER_ID);
      map.removeSource(ROUTE_SOURCE_ID);
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
        ? { top: 70, left: 70, right: 70, bottom: Math.round(height * 0.32) + 40 }
        : 60;
      map.fitBounds(bounds, { padding, maxZoom: 12, duration: isExport ? 0 : 500 });
    }

    // Export path only: signal when the freshly-fitted map has finished painting so the
    // capture happens against the real view, not the default center/zoom (the earlier bug).
    if (onReadyRef.current) {
      const cb = onReadyRef.current;
      map.once('idle', () => cb());
    }
  }, [locations, routeGeometry, routes, tripLabels, accentColor, showLabels, labeledIds, loaded]);

  return <div ref={containerRef} className="h-full w-full rounded-2xl" />;
}
