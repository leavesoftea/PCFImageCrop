import { useState, useCallback, useEffect, useRef } from "react";
import {
  getCoverScale,
  getCenterTranslation,
  clampTranslation,
  getScaleLimits,
  zoomAtPoint,
  ViewTransform,
} from "../utils/viewportUtils";

/**
 * Internal view transform state for pan/zoom. Kept separate from crop rectangle.
 * - scale: zoom (min = cover scale so viewport is always filled)
 * - translateX, translateY: pan in viewport pixels (transform-origin 0,0)
 * - On image load: cover fit (baseScale, centered).
 * - On viewport resize: preserve zoom factor and pan center, then clamp.
 */
export function useImageViewTransform(
  viewportWidth: number,
  viewportHeight: number,
  naturalWidth: number,
  naturalHeight: number,
  isReady: boolean
) {
  const [transform, setTransform] = useState<ViewTransform>({
    scale: 1,
    translateX: 0,
    translateY: 0,
  });
  const lastViewportRef = useRef({ width: 0, height: 0 });
  const lastNaturalRef = useRef({ width: 0, height: 0 });
  const transformRef = useRef(transform);
  transformRef.current = transform;

  // On load / new image: cover fit. On viewport resize only: preserve zoom factor and pan center, then clamp.
  // Only run initial fit when dimensions actually changed (first run or new image), so we never overwrite scale after user zoom.
  useEffect(() => {
    if (!isReady || viewportWidth <= 0 || viewportHeight <= 0 || naturalWidth <= 0 || naturalHeight <= 0) {
      return;
    }
    const oldW = lastViewportRef.current.width;
    const oldH = lastViewportRef.current.height;
    const oldNatW = lastNaturalRef.current.width;
    const oldNatH = lastNaturalRef.current.height;
    const viewportChanged = oldW > 0 && oldH > 0 && (oldW !== viewportWidth || oldH !== viewportHeight);
    const naturalChanged = oldNatW !== naturalWidth || oldNatH !== naturalHeight;
    const isResize = viewportChanged && !naturalChanged;
    const isFirstRun = oldNatW === 0 && oldNatH === 0;

    if (isResize) {
      const oldBaseScale = getCoverScale(oldW, oldH, naturalWidth, naturalHeight);
      const newBaseScale = getCoverScale(viewportWidth, viewportHeight, naturalWidth, naturalHeight);
      const { maxScale } = getScaleLimits(viewportWidth, viewportHeight, naturalWidth, naturalHeight);
      const t = transformRef.current;
      const zoomFactor = oldBaseScale > 0 ? t.scale / oldBaseScale : 1;
      const newScale = Math.max(newBaseScale, Math.min(maxScale, newBaseScale * zoomFactor));
      // Pan center in image coords (point at old viewport center)
      const imgCenterX = (oldW / 2 - t.translateX) / t.scale;
      const imgCenterY = (oldH / 2 - t.translateY) / t.scale;
      const newTx = viewportWidth / 2 - imgCenterX * newScale;
      const newTy = viewportHeight / 2 - imgCenterY * newScale;
      const clamped = clampTranslation(
        viewportWidth,
        viewportHeight,
        naturalWidth,
        naturalHeight,
        newScale,
        newTx,
        newTy
      );
      setTransform({ scale: newScale, ...clamped });
    } else if (naturalChanged || isFirstRun) {
      // Initial cover fit: only when new image or first time we have dimensions (do not overwrite after user zoom).
      const scale = getCoverScale(viewportWidth, viewportHeight, naturalWidth, naturalHeight);
      const { translateX, translateY } = getCenterTranslation(
        viewportWidth,
        viewportHeight,
        naturalWidth,
        naturalHeight,
        scale
      );
      setTransform({ scale, translateX, translateY });
    }
    lastViewportRef.current = { width: viewportWidth, height: viewportHeight };
    lastNaturalRef.current = { width: naturalWidth, height: naturalHeight };
  }, [isReady, viewportWidth, viewportHeight, naturalWidth, naturalHeight]);

  const clamp = useCallback(
    (t: ViewTransform): ViewTransform => {
      const { translateX, translateY } = clampTranslation(
        viewportWidth,
        viewportHeight,
        naturalWidth,
        naturalHeight,
        t.scale,
        t.translateX,
        t.translateY
      );
      return { ...t, translateX, translateY };
    },
    [viewportWidth, viewportHeight, naturalWidth, naturalHeight]
  );

  const panBy = useCallback(
    (deltaX: number, deltaY: number) => {
      setTransform((prev) => {
        const next = { ...prev, translateX: prev.translateX + deltaX, translateY: prev.translateY + deltaY };
        return clamp(next);
      });
    },
    [clamp]
  );

  /**
   * Apply a new scale while keeping an anchor point fixed (or center if not provided).
   * Used by wheel, pinch, and any external scale updates so image stays anchored.
   */
  const applyScale = useCallback(
    (newScale: number, anchorPx?: number, anchorPy?: number) => {
      setTransform((prev) => {
        const { minScale, maxScale } = getScaleLimits(
          viewportWidth,
          viewportHeight,
          naturalWidth,
          naturalHeight
        );
        const clampedScale = Math.max(minScale, Math.min(maxScale, newScale));
        const px = anchorPx ?? viewportWidth / 2;
        const py = anchorPy ?? viewportHeight / 2;
        const { translateX, translateY } = zoomAtPoint(
          viewportWidth,
          viewportHeight,
          naturalWidth,
          naturalHeight,
          prev.scale,
          clampedScale,
          prev.translateX,
          prev.translateY,
          px,
          py
        );
        return clamp({ scale: clampedScale, translateX, translateY });
      });
    },
    [viewportWidth, viewportHeight, naturalWidth, naturalHeight, clamp]
  );

  const zoomAt = useCallback(
    (viewportPx: number, viewportPy: number, deltaScale: number) => {
      const t = transformRef.current;
      const { minScale, maxScale } = getScaleLimits(
        viewportWidth,
        viewportHeight,
        naturalWidth,
        naturalHeight
      );
      const proposedScale = t.scale * deltaScale;
      const clampedScale = Math.max(minScale, Math.min(maxScale, proposedScale));
      applyScale(clampedScale, viewportPx, viewportPy);
    },
    [viewportWidth, viewportHeight, naturalWidth, naturalHeight, applyScale]
  );

  const setTransformDirect = useCallback(
    (t: ViewTransform) => setTransform(clamp(t)),
    [clamp]
  );

  return { transform, panBy, zoomAt, applyScale, setTransformDirect, clamp };
}
