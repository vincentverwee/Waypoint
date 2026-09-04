'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { domToBlob } from 'modern-screenshot';

/** iOS/iPadOS (incl. iPadOS reporting itself as "MacIntel" with a touch screen). */
export function isIOS() {
  if (typeof navigator === 'undefined') return false;
  return (
    /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export interface RenderedImage {
  url: string;
  blob: Blob;
  name: string;
}

export interface RenderOptions {
  width: number;
  height: number;
  /** Fills behind the stage's rounded corners so they don't export as transparent notches. */
  backgroundColor: string;
  fileName: string;
}

/**
 * Rasterizes a DOM node to a PNG and saves it — as TWO separate user actions, deliberately.
 *
 * Rendering takes seconds (a full-resolution map canvas plus embedded fonts). On iOS Safari a
 * download or share fired at the end of that has outlived the tap's *transient user activation*
 * and is silently dropped — which is exactly how the export used to fail on iPhone ("tap, flash,
 * nothing"). So `render()` only produces the image; the caller shows it and lets the user tap
 * again, and that fresh tap calls `save()`.
 *
 * Two other iOS details baked in here:
 *  - a Blob + object URL, never a base64 `data:` URL — a 1080×1920 PNG is several megabytes and
 *    iOS Safari refuses to download a `data:` URL that large;
 *  - `save()` must not `await` anything before `navigator.share()`, since an await drops the
 *    activation. The share sheet's "Save Image" is the only real route into Photos on iOS.
 */
export function useImageExport() {
  const [rendered, setRendered] = useState<RenderedImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const urlRef = useRef<string | null>(null);

  /** Drop a previously rendered image — anything that changes the picture invalidates it. */
  const clear = useCallback(() => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    setRendered(null);
    setError(null);
  }, []);

  // Release the last object URL when the page goes away.
  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    []
  );

  /** Step 1 — rasterize `node` into a Blob. Slow; does NOT try to save. */
  const render = useCallback(
    async (node: HTMLElement, opts: RenderOptions) => {
      clear();
      setBusy(true);
      try {
        // Make sure the web font is loaded so captions don't fall back to a system font.
        if (typeof document !== 'undefined' && 'fonts' in document) {
          try {
            await (document as Document & { fonts: FontFaceSet }).fonts.ready;
          } catch {
            /* fonts.ready unsupported — the explicit sans stacks still keep it off serif */
          }
        }
        // Small settle so the map has painted its latest frame before we read its canvas.
        await new Promise((r) => setTimeout(r, 350));

        const blob = await domToBlob(node, {
          width: opts.width,
          height: opts.height,
          scale: 1,
          type: 'image/png',
          backgroundColor: opts.backgroundColor,
          // Wait for web fonts to be embedded so the caption never falls back to a system font.
          font: {},
        });
        const url = URL.createObjectURL(blob);
        urlRef.current = url;
        setRendered({ url, blob, name: opts.fileName });
      } catch (err) {
        // Surface it — a swallowed rejection here just looked like a dead button.
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [clear]
  );

  /** Step 2 — save the already-rendered Blob. Call from a fresh tap, with no `await` before it. */
  const save = useCallback(() => {
    if (!rendered) return;
    const file = new File([rendered.blob], rendered.name, { type: 'image/png' });

    // iOS has no real "download": the share sheet ("Save Image") is the native way into Photos.
    if (
      isIOS() &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [file] })
    ) {
      navigator.share({ files: [file], title: rendered.name }).catch(() => {
        /* dismissed, or share refused — the image is still on screen to long-press */
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
  }, [rendered]);

  return { rendered, error, busy, render, save, clear };
}
