export interface ExportFormat {
  id: string;
  label: string;
  width: number;
  height: number;
}

export const EXPORT_FORMATS: ExportFormat[] = [
  { id: 'portrait', label: '1080 × 1350', width: 1080, height: 1350 },
  { id: 'story', label: '1080 × 1920', width: 1080, height: 1920 },
  { id: 'square-hd', label: '1920 × 1920', width: 1920, height: 1920 },
  { id: 'square', label: '1080 × 1080', width: 1080, height: 1080 },
];

/** Overlay typography is authored against a 1080px-wide design and multiplied by
 *  `width / DESIGN_WIDTH`, so the shrunk on-screen preview and the full-resolution
 *  capture stay proportionally identical. */
export const DESIGN_WIDTH = 1080;

/** How wide the (transform-shrunk) preview is allowed to be displayed in the panel. */
export const PREVIEW_MAX_WIDTH = 380;

/** Concrete sans stack so the export never falls back to serif if Inter isn't embedded in time. */
export const SANS_STACK =
  "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export function slugify(text: string) {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'trip'
  );
}
