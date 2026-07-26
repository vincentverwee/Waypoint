'use client';

import { useEffect } from 'react';

/**
 * Registers the Waypoint service worker (see /public/sw.js) for offline support.
 * Only runs in production — a SW in dev fights Turbopack HMR and caches stale
 * bundles. Renders nothing.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.error('SW registration failed:', err);
      });
    };

    // Wait for load so registration never competes with initial page work.
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });

    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}
