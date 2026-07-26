/*
 * Waypoint service worker — hand-rolled (no next-pwa/Serwist) so it stays
 * compatible with Next 16 + Turbopack. Provides offline support via a mix of
 * caching strategies picked per request type.
 *
 * Bump SW_VERSION whenever this file changes to roll all caches.
 */
const SW_VERSION = 'v1';
const SHELL_CACHE = `waypoint-shell-${SW_VERSION}`;
const STATIC_CACHE = `waypoint-static-${SW_VERSION}`;
const TILE_CACHE = `waypoint-tiles-${SW_VERSION}`;
const PAGE_CACHE = `waypoint-pages-${SW_VERSION}`;
const API_CACHE = `waypoint-api-${SW_VERSION}`;

const OFFLINE_URL = '/offline.html';

// Minimal app shell precached at install so the offline fallback always works.
const SHELL_ASSETS = [
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Soft caps so runtime caches don't grow unbounded (LRU-ish: oldest evicted).
const TILE_LIMIT = 300;
const PAGE_LIMIT = 50;
const API_LIMIT = 50;

async function trimCache(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  if (keys.length <= max) return;
  // keys() preserves insertion order → drop the oldest entries first.
  await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL_CACHE, STATIC_CACHE, TILE_CACHE, PAGE_CACHE, API_CACHE]);
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => n.startsWith('waypoint-') && !keep.has(n)).map((n) => caches.delete(n))
      );
      await self.clients.claim();
    })()
  );
});

// Let the page tell a waiting SW to activate immediately (used after an update).
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

// ---- strategies ------------------------------------------------------------

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request, cacheName, limit) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone()).then(() => trimCache(cacheName, limit));
      }
      return response;
    })
    .catch(() => null);
  return cached || (await network) || Response.error();
}

async function networkFirst(request, cacheName, limit, fallback) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone()).then(() => trimCache(cacheName, limit));
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (fallback) {
      const fallbackResponse = await caches.match(fallback);
      if (fallbackResponse) return fallbackResponse;
    }
    throw err;
  }
}

// ---- routing ---------------------------------------------------------------

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only GET is cacheable; let everything else hit the network untouched.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Ignore non-http(s) schemes (chrome-extension:, etc.).
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  const isSameOrigin = url.origin === self.location.origin;

  // App navigations: network-first so content stays fresh, fall back to the
  // last-seen page, then to the offline shell.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, PAGE_CACHE, PAGE_LIMIT, OFFLINE_URL));
    return;
  }

  // Next.js build output is content-hashed & immutable → cache-first.
  if (isSameOrigin && (url.pathname.startsWith('/_next/static') || url.pathname.startsWith('/_next/image'))) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Map tiles / style / glyphs / sprites — heavy and rarely change.
  if (url.hostname === 'tiles.openfreemap.org') {
    event.respondWith(staleWhileRevalidate(request, TILE_CACHE, TILE_LIMIT));
    return;
  }

  // Routing (OSRM) and data (Supabase): network-first, cache as offline backup.
  if (url.hostname === 'router.project-osrm.org' || url.hostname.endsWith('.supabase.co')) {
    event.respondWith(networkFirst(request, API_CACHE, API_LIMIT));
    return;
  }

  // Geocoding search is live/typeahead — never serve stale; skip the SW.
  if (url.hostname === 'nominatim.openstreetmap.org') return;

  // Other same-origin GETs (icons, manifest, public assets): cache-first.
  if (isSameOrigin) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
    return;
  }

  // Cross-origin fallthrough: let the browser handle it normally.
});
