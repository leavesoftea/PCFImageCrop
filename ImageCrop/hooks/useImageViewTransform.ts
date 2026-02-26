import { useState, useCallback, useEffect } from "react";
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

  // When viewport or image size is ready, set initial cover fit
  useEffect(() => {
    if (!isReady || viewportWidth <= 0 || viewportHeight <= 0 || naturalWidth <= 0 || naturalHeight <= 0) {
      return;
    }
    const scale = getCoverScale(viewportWidth, viewportHeight, naturalWidth, naturalHeight);
    const { translateX, translateY } = getCenterTranslation(
      viewportWidth,
      viewportHeight,
      naturalWidth,
      naturalHeight,
      scale
    );
    setTransform({ scale, translateX, translateY });
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

  const zoomAt = useCallback(
    (viewportPx: number, viewportPy: number, deltaScale: number) => {
      setTransform((prev) => {
        const { minScale, maxScale } = getScaleLimits(
          viewportWidth,
          viewportHeight,
          naturalWidth,
          naturalHeight
        );
        const newScale = Math.max(minScale, Math.min(maxScale, prev.scale * deltaScale));
        const { translateX, translateY } = zoomAtPoint(
          viewportWidth,
          viewportHeight,
          naturalWidth,
          naturalHeight,
          prev.scale,
          newScale,
          prev.translateX,
          prev.translateY,
          viewportPx,
          viewportPy
        );
        return clamp({ scale: newScale, translateX, translateY });
      });
    },
    [viewportWidth, viewportHeight, naturalWidth, naturalHeight, clamp]
  );

  const setTransformDirect = useCallback(
    (t: ViewTransform) => setTransform(clamp(t)),
    [clamp]
  );

  return { transform, panBy, zoomAt, setTransformDirect, clamp };
}
