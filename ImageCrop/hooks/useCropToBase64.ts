import { useEffect, RefObject } from "react";
import { PixelCrop } from "react-image-crop";

/** Viewport-space crop rect (control pixels). */
export interface ViewportCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Current view transform (same as used for rendering). */
export interface ViewportTransform {
  scale: number;
  translateX: number;
  translateY: number;
}

/** Optional ref updated each render with latest viewportCrop + transform; when provided, preview reads from it in rAF so it never uses stale state. */
export interface ExportStateRef {
  current: { viewportCrop: ViewportCrop; transform: ViewportTransform } | null;
}

/** Set true to draw debug border + crosshairs on export canvas; set false and remove block after confirming. */
const SHOW_EXPORT_DEBUG = false;
/** Set true to log cropRect + transform used in preview (compare with overlay); set false and remove after confirming. */
const SHOW_PREVIEW_STATE_DEBUG = false;

/**
 * Custom hook to convert a cropped region of an image to a base64 PNG string.
 * Two modes:
 * 1) Viewport-based (when viewportCrop + transform provided): output is exactly the crop window in viewport pixels; image is drawn with the same transform; areas outside the image stay transparent. No clamping/wrapping.
 * 2) Display-space (otherwise): completedCrop in display pixels, with scaleX/scaleY and optional rotation/scaling.
 */
export function useCropToBase64(
  imgRef: RefObject<HTMLImageElement | null>,
  completedCrop: PixelCrop | undefined,
  onCropComplete: (base64: string) => void,
  rotation = 0,
  scaling = 1,
  circularCrop = false,
  viewportCrop?: ViewportCrop,
  transform?: ViewportTransform,
  exportStateRef?: ExportStateRef
) {
  useEffect(() => {
    const image = imgRef.current;
    if (!image) {
      onCropComplete(getBlankImageBase64());
      return;
    }

    const imgW = image.naturalWidth;
    const imgH = image.naturalHeight;
    const pixelRatio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

    // Viewport-based export: canvas size = crop rect (viewport pixels); draw with current transform; read latest state from ref in rAF to avoid stale values
    if (viewportCrop != null && transform != null && imgW > 0 && imgH > 0) {
      const raf = requestAnimationFrame(() => {
        const img = imgRef.current;
        if (!img || img.naturalWidth !== imgW || img.naturalHeight !== imgH) return;
        const state = exportStateRef?.current ?? { viewportCrop, transform };
        const cropRect = state.viewportCrop;
        const t = state.transform;
        const x = Math.round(cropRect.x);
        const y = Math.round(cropRect.y);
        const w = Math.round(cropRect.width);
        const h = Math.round(cropRect.height);
        if (w <= 0 || h <= 0) {
          onCropComplete(getBlankImageBase64());
          return;
        }

        if (SHOW_PREVIEW_STATE_DEBUG) {
          // eslint-disable-next-line no-console
          console.log("preview: cropRect =", { x: cropRect.x, y: cropRect.y, w: cropRect.width, h: cropRect.height }, "transform =", { scale: t.scale, tx: t.translateX, ty: t.translateY });
        }

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        ctx.clearRect(0, 0, w, h);

        const dx = t.translateX - x;
        const dy = t.translateY - y;
        const dw = imgW * t.scale;
        const dh = imgH * t.scale;

        if (circularCrop) {
          ctx.save();
          ctx.beginPath();
          ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, 2 * Math.PI);
          ctx.closePath();
          ctx.clip();
        }

        ctx.drawImage(img, 0, 0, imgW, imgH, dx, dy, dw, dh);

        if (circularCrop) {
          ctx.restore();
        }

        if (SHOW_EXPORT_DEBUG) {
          ctx.strokeStyle = "black";
          ctx.lineWidth = 1;
          ctx.strokeRect(0, 0, w, h);
          ctx.beginPath();
          ctx.moveTo(w / 2, 0);
          ctx.lineTo(w / 2, h);
          ctx.moveTo(0, h / 2);
          ctx.lineTo(w, h / 2);
          ctx.stroke();
          // eslint-disable-next-line no-console
          console.log("export", { cropRect, x, y, w, h, scale: t.scale, translateX: t.translateX, translateY: t.translateY });
        }

        canvas.toBlob(
          (blob) => {
            if (!blob) return;
            const reader = new FileReader();
            reader.onloadend = () => {
              if (typeof reader.result === "string") onCropComplete(reader.result);
            };
            reader.readAsDataURL(blob);
          },
          "image/png"
        );
      });
      return () => cancelAnimationFrame(raf);
    }

    // Display-space path (no pan/zoom or legacy)
    if (!completedCrop || completedCrop.width <= 0 || completedCrop.height <= 0) {
      onCropComplete(getBlankImageBase64());
      return;
    }

    const scaleX = imgW / image.width;
    const scaleY = imgH / image.height;
    const cropX = completedCrop.x * scaleX;
    const cropY = completedCrop.y * scaleY;
    const cropW = completedCrop.width * scaleX;
    const cropH = completedCrop.height * scaleY;

    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(cropW * pixelRatio);
    canvas.height = Math.floor(cropH * pixelRatio);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(pixelRatio, pixelRatio);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    if (circularCrop) {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(cropW / 2, cropH / 2, cropW / 2, cropH / 2, 0, 0, 2 * Math.PI);
      ctx.closePath();
      ctx.clip();
    }

    const rotateRads = (rotation * Math.PI) / 180;
    const centerX = imgW / 2;
    const centerY = imgH / 2;
    ctx.save();
    ctx.translate(-cropX, -cropY);
    ctx.translate(centerX, centerY);
    ctx.rotate(rotateRads);
    ctx.scale(scaling, scaling);
    ctx.translate(-centerX, -centerY);
    ctx.drawImage(image, 0, 0, imgW, imgH, 0, 0, imgW, imgH);
    ctx.restore();

    if (circularCrop) {
      ctx.restore();
    }

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === "string") onCropComplete(reader.result);
        };
        reader.readAsDataURL(blob);
      },
      "image/png"
    );
  }, [
    completedCrop,
    imgRef,
    rotation,
    scaling,
    circularCrop,
    viewportCrop,
    transform,
    exportStateRef,
    viewportCrop?.x,
    viewportCrop?.y,
    viewportCrop?.width,
    viewportCrop?.height,
    transform?.scale,
    transform?.translateX,
    transform?.translateY,
  ]);
}

function getBlankImageBase64(width = 1, height = 1): string {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, width, height);
  }
  return canvas.toDataURL("image/png");
}
