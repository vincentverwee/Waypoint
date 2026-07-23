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

interface MapViewProps {
  locations?: Location[];
  /** Single-trip route line (trip detail page). For multiple trips at once, use `routes` instead. */
  routeGeometry?: GeoJSON.LineString | null;
  /** One route line per trip, each colored to match that trip's markers (dashboard, world map). */
  routes?: TripRoute[];
  /** Optional label shown per-marker, e.g. the trip title when plotting multiple trips together. */
  tripLabels?: Record<string, string>;
}

export default function MapView({
  locations = [],
  routeGeometry = null,
  routes,
  tripLabels,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [4.4, 50.85],
      zoom: 5,
    });
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.on('load', () => {
      // In dev, React Strict Mode mounts/cleans up/remounts this effect; guard against a
      // stale map's late 'load' event marking a since-replaced instance as ready.
      if (mapRef.current === map) setLoaded(true);
    });
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      setLoaded(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;

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

      const color = tripLabels ? colorForTrip(loc.trip_id) : '#4f46e5';
      const el = document.createElement('div');
      el.style.cssText = `display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:9999px;border:2px solid white;background:${color};color:white;font-size:11px;font-weight:700;box-shadow:0 1px 4px rgba(0,0,0,0.35);cursor:pointer;`;
      el.textContent = String(number);

      const label = tripLabels?.[loc.trip_id] ?? '';
      return new maplibregl.Marker({ element: el })
        .setLngLat([loc.longitude, loc.latitude])
        .setPopup(new maplibregl.Popup({ offset: 16 }).setDOMContent(buildPopupContent(loc, label)))
        .addTo(map);
    });

    const routeFeatures: GeoJSON.Feature[] = routes?.length
      ? routes.map((r) => ({
          type: 'Feature',
          properties: { color: tripLabels ? colorForTrip(r.tripId) : '#4f46e5' },
          geometry: r.geometry,
        }))
      : routeGeometry
        ? [{ type: 'Feature', properties: { color: '#4f46e5' }, geometry: routeGeometry }]
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
      map.fitBounds(bounds, { padding: 60, maxZoom: 12, duration: 500 });
    }
  }, [locations, routeGeometry, routes, tripLabels, loaded]);

  return <div ref={containerRef} className="h-full w-full rounded-2xl" />;
}
