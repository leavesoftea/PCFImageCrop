/**
 * Utilities for pan/zoom view transform: cover fit and constraint clamping.
 * Ensures the image always fills the viewport (no empty space inside crop box).
 */

export interface ViewTransform {
  scale: number;
  translateX: number;
  translateY: number;
}

/** Zoom range as multiplier of baseScale (cover-fit scale). minScale = baseScale * MIN_ZOOM_MULTIPLIER, maxScale = baseScale * MAX_ZOOM_MULTIPLIER. */
const MIN_ZOOM_MULTIPLIER = 0.4;
const MAX_ZOOM_MULTIPLIER = 3.0;

/**
 * Compute scale so the image "covers" the viewport (like CSS object-fit: cover).
 * scale = max(viewportW / imgW, viewportH / imgH).
 */
export function getCoverScale(
  viewportW: number,
  viewportH: number,
  imgW: number,
  imgH: number
): number {
  if (imgW <= 0 || imgH <= 0) return 1;
  return Math.max(viewportW / imgW, viewportH / imgH);
}

/**
 * Compute translation so the image is centered in the viewport at the given scale.
 * transform-origin is (0,0): image top-left at (translateX, translateY).
 */
export function getCenterTranslation(
  viewportW: number,
  viewportH: number,
  imgW: number,
  imgH: number,
  scale: number
): { translateX: number; translateY: number } {
  const scaledW = imgW * scale;
  const scaledH = imgH * scale;
  return {
    translateX: (viewportW - scaledW) / 2,
    translateY: (viewportH - scaledH) / 2,
  };
}

/**
 * Clamp translation so the image always covers the viewport (no blank space).
 * Image rendered size: rw = imgW*scale, rh = imgH*scale. Image top-left at (tx, ty).
 * To cover viewport: tx <= 0, tx + rw >= viewportW => tx >= viewportW - rw. So tx in [viewportW - rw, 0].
 * Same for y: ty in [viewportH - rh, 0]. Formula: clamp(tx, viewportW - rw, 0).
 * (At minScale=coverScale we have rw >= viewportW, rh >= viewportH; if rw < viewportW, center tx.)
 */
export function clampTranslation(
  viewportW: number,
  viewportH: number,
  imgW: number,
  imgH: number,
  scale: number,
  translateX: number,
  translateY: number
): { translateX: number; translateY: number } {
  const rw = imgW * scale;
  const rh = imgH * scale;
  let minX = viewportW - rw;
  let maxX = 0;
  let minY = viewportH - rh;
  let maxY = 0;
  if (rw < viewportW) {
    minX = maxX = (viewportW - rw) / 2;
  }
  if (rh < viewportH) {
    minY = maxY = (viewportH - rh) / 2;
  }
  return {
    translateX: Math.max(minX, Math.min(maxX, translateX)),
    translateY: Math.max(minY, Math.min(maxY, translateY)),
  };
}

/**
 * Get min and max scale for zoom. baseScale = cover-fit scale (image fills control, centered).
 * Zoom bounds: minScale = baseScale * 0.4, maxScale = baseScale * 3.0.
 * clamp(v, min, max) = Math.max(min, Math.min(max, v)).
 */
export function getScaleLimits(
  viewportW: number,
  viewportH: number,
  imgW: number,
  imgH: number
): { minScale: number; maxScale: number; baseScale: number } {
  if (viewportW <= 0 || viewportH <= 0 || imgW <= 0 || imgH <= 0) {
    return { minScale: 0.001, maxScale: 8, baseScale: 1 };
  }
  const baseScale = getCoverScale(viewportW, viewportH, imgW, imgH);
  const minScale = baseScale * MIN_ZOOM_MULTIPLIER;
  const maxScale = baseScale * MAX_ZOOM_MULTIPLIER;
  return {
    minScale,
    maxScale,
    baseScale,
  };
}

/**
 * Zoom at a viewport point (px, py) so that point stays under the cursor.
 * Returns new translate so that (px, py) still maps to the same image point.
 */
export function zoomAtPoint(
  viewportW: number,
  viewportH: number,
  imgW: number,
  imgH: number,
  scale: number,
  newScale: number,
  translateX: number,
  translateY: number,
  px: number,
  py: number
): { translateX: number; translateY: number } {
  // Image point under (px, py): ((px - tx) / scale, (py - ty) / scale)
  // We want the same image point at (px, py) with newScale: tx' = px - (px - tx) * newScale/scale
  const factor = newScale / scale;
  const tx = px - (px - translateX) * factor;
  const ty = py - (py - translateY) * factor;
  const clamped = clampTranslation(viewportW, viewportH, imgW, imgH, newScale, tx, ty);
  return clamped;
}
