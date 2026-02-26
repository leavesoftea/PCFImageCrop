/**
 * Utilities for pan/zoom view transform: cover fit and constraint clamping.
 * Ensures the image always fills the viewport (no empty space inside crop box).
 */

export interface ViewTransform {
  scale: number;
  translateX: number;
  translateY: number;
}

/** Minimum scale = cover (viewport always filled). Max scale multiple over cover (e.g. 8x). */
const MAX_SCALE_MULTIPLE = 8;

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
 * Clamp translation so the image always covers the viewport (no empty space).
 * Image rect in viewport: [translateX, translateY, translateX + imgW*scale, translateY + imgH*scale].
 * We need: translateX <= 0, translateY <= 0, translateX + imgW*scale >= viewportW, translateY + imgH*scale >= viewportH.
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
  const scaledW = imgW * scale;
  const scaledH = imgH * scale;
  const minX = viewportW - scaledW;
  const minY = viewportH - scaledH;
  return {
    translateX: Math.max(minX, Math.min(0, translateX)),
    translateY: Math.max(minY, Math.min(0, translateY)),
  };
}

/**
 * Get min (cover) and max scale for the viewport and image.
 */
export function getScaleLimits(
  viewportW: number,
  viewportH: number,
  imgW: number,
  imgH: number
): { minScale: number; maxScale: number } {
  const minScale = getCoverScale(viewportW, viewportH, imgW, imgH);
  return {
    minScale,
    maxScale: minScale * MAX_SCALE_MULTIPLE,
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
