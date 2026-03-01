import * as React from "react";
import { Crop, PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { usePcfContext } from "../services/pcfContext";
import { IImageCropControlProps } from "../types/imageCropTypes";
import {
    useImageSrc,
    useMinWidth,
    useMaxWidth,
    useMinHeight,
    useMaxHeight,
    useAspect,
    useLocked,
    useRuleOfThirds,
    useCircularCrop,
    useDisabled,
    useCropToBase64,
    useKeepSelection,
    useRotation,
    useScaling,
    useDefaultCrop,
    useShowCropByDefault,
    useEnableCropping,
    useEnablePanImage,
    useShiftToPanImage,
    useEnableDragDropLoad,
    useImageViewTransform,
    type ViewportCrop,
    type ViewportTransform,
} from "../hooks";
import CropWrapper from "./imageCropWrapper";
import { getScaleLimits } from "../utils/viewportUtils";

const ZOOM_MULTIPLIER_MIN = 0.4;
const ZOOM_MULTIPLIER_MAX = 3.0;

/** Max file size for drag-drop load (15MB) to avoid huge base64 payloads. */
const MAX_DROP_FILE_BYTES = 15 * 1024 * 1024;

/** Set to true to show crop/transform debug overlay; set false before release. */
const SHOW_CROP_DEBUG = false;
/** Set true to log viewport transform (truth) next to render; set false and remove after verifying. */
const SHOW_VIEWPORT_TRANSFORM_DEBUG = false;

/** Default crop box size: 200x200 viewport pixels. Centered; clamped to viewport if smaller. */
function defaultViewportCrop200(viewportW: number, viewportH: number): Crop {
    const defaultW = Math.min(200, viewportW);
    const defaultH = Math.min(200, viewportH);
    const x = (viewportW - defaultW) / 2;
    const y = (viewportH - defaultH) / 2;
    return { unit: "px", x, y, width: defaultW, height: defaultH };
}

/** Convert viewport-space crop to image (natural) pixel space using inverse transform; clamp to image bounds. */
function viewportCropToNaturalPx(
    viewportCrop: { x: number; y: number; width: number; height: number },
    scale: number,
    tx: number,
    ty: number,
    naturalW: number,
    naturalH: number
): PixelCrop {
    const ix = (viewportCrop.x - tx) / scale;
    const iy = (viewportCrop.y - ty) / scale;
    const iw = viewportCrop.width / scale;
    const ih = viewportCrop.height / scale;
    const x1 = Math.max(0, Math.min(ix, naturalW));
    const y1 = Math.max(0, Math.min(iy, naturalH));
    const x2 = Math.max(x1, Math.min(ix + iw, naturalW));
    const y2 = Math.max(y1, Math.min(iy + ih, naturalH));
    return {
        unit: "px",
        x: x1,
        y: y1,
        width: Math.max(0, x2 - x1),
        height: Math.max(0, y2 - y1),
    };
}

/** Convert image-space crop to viewport-space px using current transform. */
function imageCropToViewportPx(
    c: Crop,
    naturalW: number,
    naturalH: number,
    scale: number,
    tx: number,
    ty: number,
    viewportW: number,
    viewportH: number
): Crop {
    const imgX = c.unit === "%" ? (c.x / 100) * naturalW : c.x;
    const imgY = c.unit === "%" ? (c.y / 100) * naturalH : c.y;
    const imgW = c.unit === "%" ? (c.width / 100) * naturalW : c.width;
    const imgH = c.unit === "%" ? (c.height / 100) * naturalH : c.height;
    return {
        unit: "px",
        x: imgX * scale + tx,
        y: imgY * scale + ty,
        width: imgW * scale,
        height: imgH * scale,
    };
}

const ImageCropControl: React.FC<IImageCropControlProps> = (props) => {
    // Get the PCF context using the custom hook
    const pcfContext = usePcfContext();
    // State to hold the completed crop object, initialized as undefined
    const [completedCrop, setCompletedCrop] = React.useState<PixelCrop>()
    // Crop state for the image, initialized as undefined
    const [crop, setCrop] = React.useState<Crop>();
    // Reference to the image element for scaling and cropping
    const imgRef = React.useRef<HTMLImageElement>(null) as React.RefObject<HTMLImageElement>;
    // Viewport ref for measuring container and attaching wheel zoom
    const viewportRef = React.useRef<HTMLDivElement>(null);
    // Natural image size (set on load) for cover fit and pan/zoom math
    const [naturalSize, setNaturalSize] = React.useState<{ width: number; height: number }>({ width: 0, height: 0 });
    // Viewport size for cover fit and constraints
    const [viewportSize, setViewportSize] = React.useState({ width: 0, height: 0 });
    // Pan state: track pointer for drag-to-pan
    const panRef = React.useRef<{ startX: number; startY: number; startTx: number; startTy: number } | null>(null);
    // Pinch state: two pointers for pinch-to-zoom
    const pinchRef = React.useRef<{ initialDistance: number; initialScale: number; centerX: number; centerY: number } | null>(null);
    const activePointersRef = React.useRef<Map<number, { clientX: number; clientY: number }>>(new Map());
    // Shift-to-pan: pan only when Shift is held; crop interactions disabled in pan mode
    const [isPanMode, setIsPanMode] = React.useState(false);
    const [isPanning, setIsPanning] = React.useState(false);
    // When usePanZoom is true, crop state is in viewport space (px). We init once when entering usePanZoom.
    const viewportCropInitializedRef = React.useRef(false);
    const cropIsViewportSpaceRef = React.useRef(false);
    // Cropping controlled by enableCropping; legacy showCropByDefault still enables crop on load when set.
    const showCropByDefault = useShowCropByDefault(pcfContext.context);
    const enableCropping = useEnableCropping(pcfContext.context);
    const isCroppingActive = enableCropping || showCropByDefault;

    // Pan: enabled only by enablePanImage; useShiftToPanImage requires Shift to be held for pan.
    const enablePanImage = useEnablePanImage(pcfContext.context);
    const shiftToPanEnabled = useShiftToPanImage(pcfContext.context);

    // Get the default crop object (not a hook)
    const defaultCrop = useDefaultCrop(pcfContext.context);
    // Source priority: override (drop) > host image > internal drop > empty. Clearing only via clearToken; host image change clears override.
    const { imageSrc, isRealImageSource } = useImageSrc(
        pcfContext.context,
        imgRef,
        defaultCrop,
        setCrop,
        setCompletedCrop,
        props.internalImageDataUrl ?? undefined,
        props.overrideHostImage ?? false
    );

    const enableDragDropLoad = useEnableDragDropLoad(pcfContext.context);
    const [isDraggingOver, setIsDraggingOver] = React.useState(false);
    const dragEnterCountRef = React.useRef(0);

    // Measure viewport when container resizes
    React.useEffect(() => {
        const el = viewportRef.current;
        if (!el) return;
        const ro = new ResizeObserver(() => {
            setViewportSize({ width: el.clientWidth, height: el.clientHeight });
        });
        ro.observe(el);
        setViewportSize({ width: el.clientWidth, height: el.clientHeight });
        return () => ro.disconnect();
    }, [imageSrc]);

    const isTransformReady = naturalSize.width > 0 && naturalSize.height > 0 && viewportSize.width > 0 && viewportSize.height > 0;
    const { transform, panBy, zoomAt, applyScale, setTransformDirect } = useImageViewTransform(
        viewportSize.width,
        viewportSize.height,
        naturalSize.width,
        naturalSize.height,
        isTransformReady
    );
    const scaling = useScaling(pcfContext.context);

    // Host scaling path: when the "scaling" input changes (slider/buttons), apply zoom anchored at viewport CENTER.
    // Wheel/pinch path must not be modified; they use zoomAt(px, py, factor) and remain pointer/pinch-anchored.
    React.useEffect(() => {
        if (!isTransformReady || viewportSize.width <= 0 || viewportSize.height <= 0 || naturalSize.width <= 0 || naturalSize.height <= 0) return;
        const { baseScale, minScale, maxScale } = getScaleLimits(
            viewportSize.width,
            viewportSize.height,
            naturalSize.width,
            naturalSize.height
        );
        if (baseScale <= 0) return;
        const cx = viewportSize.width / 2;
        const cy = viewportSize.height / 2;
        const newScale = Math.max(minScale, Math.min(maxScale, baseScale * scaling));
        applyScale(newScale, cx, cy);
    }, [scaling, isTransformReady, viewportSize.width, viewportSize.height, naturalSize.width, naturalSize.height, applyScale]);

    // Sync zoom multiplier to output whenever scale or baseScale changes (wheel, pinch, host scaling, load, resize).
    React.useEffect(() => {
        if (!isTransformReady || !props.onZoomMultiplierChange) return;
        const { baseScale } = getScaleLimits(
            viewportSize.width,
            viewportSize.height,
            naturalSize.width,
            naturalSize.height
        );
        if (baseScale <= 0) return;
        const raw = transform.scale / baseScale;
        const zoomMultiplier = Math.max(ZOOM_MULTIPLIER_MIN, Math.min(ZOOM_MULTIPLIER_MAX, raw));
        props.onZoomMultiplierChange(zoomMultiplier);
    }, [isTransformReady, viewportSize.width, viewportSize.height, naturalSize.width, naturalSize.height, transform.scale, props.onZoomMultiplierChange]);

    const handleImageLoad = React.useCallback(() => {
        const img = imgRef.current;
        if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
            setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
            if (isRealImageSource) props.onImageLoadedChange?.(true);
        }
    }, [isRealImageSource, props.onImageLoadedChange]);

    const handleImageError = React.useCallback(() => {
        props.onImageLoadedChange?.(false);
    }, [props.onImageLoadedChange]);

    // Reset natural size when image src changes so we re-fit on new image
    React.useEffect(() => {
        if (!imageSrc) setNaturalSize({ width: 0, height: 0 });
    }, [imageSrc]);


    const handleWheel = React.useCallback(
        (e: WheelEvent) => {
            if (!viewportRef.current || !isTransformReady) return;
            const rect = viewportRef.current.getBoundingClientRect();
            const px = e.clientX - rect.left;
            const py = e.clientY - rect.top;
            const zoomFactor = Math.exp(-e.deltaY * 0.001);
            zoomAt(px, py, zoomFactor);
            e.preventDefault();
        },
        [zoomAt, isTransformReady]
    );

    // Attach wheel to the control container (same element as ref); passive: false so preventDefault() works
    React.useEffect(() => {
        const el = viewportRef.current;
        if (!el) return;
        el.addEventListener("wheel", handleWheel, { passive: false });
        return () => el.removeEventListener("wheel", handleWheel);
    }, [handleWheel]);

    // Shift-to-pan: global key and viewport blur/leave so pan mode is not stuck
    React.useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Shift") setIsPanMode(true);
        };
        const onKeyUp = (e: KeyboardEvent) => {
            if (e.key === "Shift") setIsPanMode(false);
        };
        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("keyup", onKeyUp);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);
        };
    }, []);
    const clearPanModeOnLeave = React.useCallback(() => setIsPanMode(false), []);

    // Drag-and-drop image load (only when enableDragDropLoad): reuse same image pipeline via setImageSrcFromDrop.
    const handleDragEnter = React.useCallback(
        (e: React.DragEvent) => {
            if (!enableDragDropLoad) return;
            if (!e.dataTransfer.types.includes("Files") || !e.dataTransfer.files?.length) return;
            e.preventDefault();
            dragEnterCountRef.current += 1;
            setIsDraggingOver(true);
        },
        [enableDragDropLoad]
    );
    const handleDragOver = React.useCallback(
        (e: React.DragEvent) => {
            if (!enableDragDropLoad) return;
            if (e.dataTransfer.types.includes("Files") && e.dataTransfer.files?.length) e.preventDefault();
        },
        [enableDragDropLoad]
    );
    const handleDragLeave = React.useCallback(
        (e: React.DragEvent) => {
            if (!enableDragDropLoad) return;
            if (viewportRef.current && e.relatedTarget && viewportRef.current.contains(e.relatedTarget as Node)) return;
            dragEnterCountRef.current = Math.max(0, dragEnterCountRef.current - 1);
            if (dragEnterCountRef.current === 0) setIsDraggingOver(false);
        },
        [enableDragDropLoad]
    );
    const handleDrop = React.useCallback(
        (e: React.DragEvent) => {
            if (!enableDragDropLoad) return;
            e.preventDefault();
            e.stopPropagation();
            dragEnterCountRef.current = 0;
            setIsDraggingOver(false);
            const file = e.dataTransfer.files?.[0];
            if (!file) return;
            if (!file.type.startsWith("image/")) {
                if (typeof console !== "undefined" && console.warn) console.warn("[ImageCrop] Dropped file is not an image:", file.type);
                return;
            }
            if (file.size > MAX_DROP_FILE_BYTES) {
                if (typeof console !== "undefined" && console.warn) console.warn("[ImageCrop] Dropped image too large (max 15MB):", file.size);
                return;
            }
            const reader = new FileReader();
            reader.onload = () => {
                const dataUrl = typeof reader.result === "string" ? reader.result : undefined;
                if (dataUrl) props.onDropSuccess?.(dataUrl);
            };
            reader.onerror = () => {
                if (typeof console !== "undefined" && console.warn) console.warn("[ImageCrop] Failed to read dropped file.");
            };
            reader.readAsDataURL(file);
        },
        [enableDragDropLoad, props.onDropSuccess]
    );

    // Pan is active only when enablePanImage and (no Shift required or Shift is down).
    const panModeActive = enablePanImage && (!shiftToPanEnabled || isPanMode);

    const getDistance = (a: { clientX: number; clientY: number }, b: { clientX: number; clientY: number }) =>
        Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
    const getCenter = (a: { clientX: number; clientY: number }, b: { clientX: number; clientY: number }) => ({
        x: (a.clientX + b.clientX) / 2,
        y: (a.clientY + b.clientY) / 2,
    });

    const handlePointerDown = React.useCallback(
        (e: React.PointerEvent) => {
            if (!isTransformReady) return;
            if (e.button !== 0) return;
            const map = activePointersRef.current;
            map.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
            if (map.size === 2) {
                const [p1, p2] = Array.from(map.values());
                const rect = viewportRef.current?.getBoundingClientRect();
                const center = getCenter(p1, p2);
                pinchRef.current = rect
                    ? {
                          initialDistance: getDistance(p1, p2),
                          initialScale: transform.scale,
                          centerX: center.x - rect.left,
                          centerY: center.y - rect.top,
                      }
                    : null;
                panRef.current = null;
            } else if (map.size === 1 && panModeActive) {
                panRef.current = {
                    startX: e.clientX,
                    startY: e.clientY,
                    startTx: transform.translateX,
                    startTy: transform.translateY,
                };
                pinchRef.current = null;
                setIsPanning(true);
            }
            if (map.size === 2 || (map.size === 1 && panModeActive)) {
                viewportRef.current?.setPointerCapture?.(e.pointerId);
                e.preventDefault();
            }
        },
        [isTransformReady, panModeActive, transform.translateX, transform.translateY, transform.scale]
    );

    const handlePointerMove = React.useCallback(
        (e: React.PointerEvent) => {
            activePointersRef.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
            const pinch = pinchRef.current;
            if (pinch && activePointersRef.current.size === 2) {
                const [p1, p2] = Array.from(activePointersRef.current.values());
                const dist = getDistance(p1, p2);
                if (pinch.initialDistance > 0 && transform.scale > 0) {
                    const targetScale = pinch.initialScale * (dist / pinch.initialDistance);
                    const factor = targetScale / transform.scale;
                    zoomAt(pinch.centerX, pinch.centerY, factor);
                }
                e.preventDefault();
                return;
            }
            const p = panRef.current;
            if (!p) return;
            const totalDx = e.clientX - p.startX;
            const totalDy = e.clientY - p.startY;
            setTransformDirect({
                scale: transform.scale,
                translateX: p.startTx + totalDx,
                translateY: p.startTy + totalDy,
            });
            e.preventDefault();
        },
        [setTransformDirect, transform.scale, zoomAt]
    );

    const handlePointerUp = React.useCallback((e: React.PointerEvent) => {
        activePointersRef.current.delete(e.pointerId);
        if (e.button === 0) {
            panRef.current = null;
            setIsPanning(false);
            if (activePointersRef.current.size !== 2) pinchRef.current = null;
        }
        viewportRef.current?.releasePointerCapture?.(e.pointerId);
    }, []);

    const handlePointerCancel = React.useCallback((e: React.PointerEvent) => {
        activePointersRef.current.delete(e.pointerId);
        panRef.current = null;
        setIsPanning(false);
        pinchRef.current = null;
    }, []);

    // Get the locked property from PCF context
    const locked = useLocked(pcfContext.context);
    // Get the disabled property from PCF context
    const disabled = useDisabled(pcfContext.context);
    // Get the ruleOfThirds property from PCF context
    const ruleOfThirds = useRuleOfThirds(pcfContext.context);
    // Get the circularCrop property from PCF context
    const circularCrop = useCircularCrop(pcfContext.context);
    // Get min/max width/height from PCF context, scaled for browser
    const minWidth = useMinWidth(pcfContext.context);
    const maxWidth = useMaxWidth(pcfContext.context);
    const minHeight = useMinHeight(pcfContext.context);
    const maxHeight = useMaxHeight(pcfContext.context);
    // Get the aspect ratio from PCF context and helper to center crop
    const [aspect] = useAspect(pcfContext.context, imgRef, setCrop);
    // Get the keepSelection property from PCF context
    const keepSelection = useKeepSelection(pcfContext.context);
    // Get the rotation property from PCF context
    const rotation = useRotation(pcfContext.context);

    const showControl = pcfContext.isVisible();
    const usePanZoom = Boolean(showControl && isTransformReady);

    // When cropping is enabled and there is no crop yet, init to default 200x200 centered (or defaultCrop/completedCrop). Preserve crop when disabling so re-enable returns to prior selection.
    React.useEffect(() => {
        if (!usePanZoom || !isCroppingActive || viewportSize.width <= 0 || viewportSize.height <= 0) {
            if (!isCroppingActive) {
                viewportCropInitializedRef.current = false;
            }
            return;
        }
        if (crop != null) return;
        viewportCropInitializedRef.current = true;
        cropIsViewportSpaceRef.current = true;
        const fallback = defaultCrop && defaultCrop.width > 0 && defaultCrop.height > 0
            ? imageCropToViewportPx(
                  defaultCrop,
                  naturalSize.width,
                  naturalSize.height,
                  transform.scale,
                  transform.translateX,
                  transform.translateY,
                  viewportSize.width,
                  viewportSize.height
              )
            : completedCrop && completedCrop.width > 0 && completedCrop.height > 0
            ? (() => {
                  const s = transform.scale;
                  const tx = transform.translateX;
                  const ty = transform.translateY;
                  return {
                      unit: "px" as const,
                      x: completedCrop.x * s + tx,
                      y: completedCrop.y * s + ty,
                      width: completedCrop.width * s,
                      height: completedCrop.height * s,
                  };
              })()
            : defaultViewportCrop200(viewportSize.width, viewportSize.height);
        setCrop(fallback);
    }, [usePanZoom, isCroppingActive, viewportSize.width, viewportSize.height, crop, defaultCrop, completedCrop, naturalSize.width, naturalSize.height, transform.scale, transform.translateX, transform.translateY]);

    // When media is viewport-sized div, library gives PixelCrop in viewport space; convert to image (natural) space for useCropToBase64 using inverse transform; clamp to image bounds.
    const handleCropComplete = React.useCallback(
        (pixelCrop: PixelCrop) => {
            if (!usePanZoom) {
                setCompletedCrop(pixelCrop);
                return;
            }
            const natural = viewportCropToNaturalPx(
                { x: pixelCrop.x, y: pixelCrop.y, width: pixelCrop.width, height: pixelCrop.height },
                transform.scale,
                transform.translateX,
                transform.translateY,
                naturalSize.width,
                naturalSize.height
            );
            setCompletedCrop(natural);
        },
        [usePanZoom, transform.scale, transform.translateX, transform.translateY, naturalSize.width, naturalSize.height]
    );

    const handleCropChange = React.useCallback(
        (c: Crop) => {
            cropIsViewportSpaceRef.current = true;
            setCrop(c);
            // Keep completedCrop in sync so export reflects current crop box when usePanZoom
            if (usePanZoom && c.unit === "px" && naturalSize.width > 0 && naturalSize.height > 0) {
                const natural = viewportCropToNaturalPx(
                    { x: c.x, y: c.y, width: c.width, height: c.height },
                    transform.scale,
                    transform.translateX,
                    transform.translateY,
                    naturalSize.width,
                    naturalSize.height
                );
                setCompletedCrop(natural);
            }
        },
        [usePanZoom, transform.scale, transform.translateX, transform.translateY, naturalSize.width, naturalSize.height]
    );

    // When usePanZoom, crop is in viewport space (px). When !isCroppingActive, pass undefined so no overlay. Else pass crop (or default 200x200 centered if not yet set).
    const cropToPass = React.useMemo(() => {
        if (!showControl) return undefined;
        if (!usePanZoom) return crop ?? { unit: "%" as const, x: 0, y: 0, width: 100, height: 100 };
        if (!isCroppingActive) return undefined;
        if (!crop) return defaultViewportCrop200(viewportSize.width, viewportSize.height);
        if (cropIsViewportSpaceRef.current) return crop;
        return imageCropToViewportPx(
            crop,
            naturalSize.width,
            naturalSize.height,
            transform.scale,
            transform.translateX,
            transform.translateY,
            viewportSize.width,
            viewportSize.height
        );
    }, [showControl, usePanZoom, isCroppingActive, crop, viewportSize.width, viewportSize.height, naturalSize.width, naturalSize.height, transform.scale, transform.translateX, transform.translateY]);

    // Single source of truth for export: same crop rect and transform as viewport img. Host scaling is baked into transform via center-anchored effect, so viewport scale = transform.scale only.
    const viewportCropForExport =
        usePanZoom && cropToPass && cropToPass.unit === "px" && cropToPass.width > 0 && cropToPass.height > 0
            ? { x: cropToPass.x, y: cropToPass.y, width: cropToPass.width, height: cropToPass.height }
            : undefined;
    const transformForExport = usePanZoom
        ? { scale: transform.scale, translateX: transform.translateX, translateY: transform.translateY }
        : undefined;
    if (SHOW_VIEWPORT_TRANSFORM_DEBUG && transformForExport) {
        // eslint-disable-next-line no-console
        console.log("viewportTransform (truth) =", { scale: transformForExport.scale, tx: transformForExport.translateX, ty: transformForExport.translateY });
    }
    const exportStateRef = React.useRef<{ viewportCrop: ViewportCrop; transform: ViewportTransform } | null>(null);
    if (viewportCropForExport && transformForExport) {
        exportStateRef.current = { viewportCrop: viewportCropForExport, transform: transformForExport };
    } else {
        exportStateRef.current = null;
    }
    useCropToBase64(
        imgRef,
        completedCrop,
        props.onCropComplete,
        rotation,
        scaling,
        circularCrop,
        viewportCropForExport,
        transformForExport,
        exportStateRef
    );

    return (
        <div
            ref={viewportRef}
            style={{
                display: showControl ? "block" : "none",
                width: "100%",
                height: "100%",
                minHeight: 200,
                overflow: "hidden",
                position: "relative",
                touchAction: usePanZoom ? "none" : undefined,
                cursor: usePanZoom && panModeActive ? (isPanning ? "grabbing" : "grab") : undefined,
            }}
            onMouseLeave={clearPanModeOnLeave}
            onBlur={clearPanModeOnLeave}
            onPointerDown={usePanZoom ? handlePointerDown : undefined}
            onPointerMove={usePanZoom ? handlePointerMove : undefined}
            onPointerUp={usePanZoom ? handlePointerUp : undefined}
            onPointerCancel={usePanZoom ? handlePointerCancel : undefined}
            onDragEnter={enableDragDropLoad ? handleDragEnter : undefined}
            onDragOver={enableDragDropLoad ? handleDragOver : undefined}
            onDragLeave={enableDragDropLoad ? handleDragLeave : undefined}
            onDrop={enableDragDropLoad ? handleDrop : undefined}
        >
            {enableDragDropLoad && isDraggingOver && (
                <div
                    aria-hidden
                    style={{
                        position: "absolute",
                        inset: 0,
                        zIndex: 20,
                        pointerEvents: "none",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "rgba(0,0,0,0.35)",
                        border: "3px dashed rgba(255,255,255,0.9)",
                        borderRadius: 4,
                        color: "#fff",
                        fontSize: 18,
                        fontWeight: 600,
                    }}
                >
                    Drop image
                </div>
            )}
            <CropWrapper
                crop={cropToPass}
                onChange={handleCropChange}
                onDragStart={(e: PointerEvent) => props.onDragStart(e)}
                onDragEnd={(e: PointerEvent) => props.onDragEnd(e)}
                onComplete={handleCropComplete}
                locked={locked || panModeActive}
                disabled={disabled}
                ruleOfThirds={ruleOfThirds}
                circularCrop={circularCrop}
                minWidth={minWidth}
                maxWidth={maxWidth}
                minHeight={minHeight}
                maxHeight={maxHeight}
                aspect={aspect}
                keepSelection={keepSelection}
                style={{
                    display: "block",
                    width: "100%",
                    height: "100%",
                    position: "absolute",
                    inset: 0,
                    overflow: "hidden",
                    zIndex: 0,
                }}
            >
                {usePanZoom ? (
                    <div
                        style={{
                            width: viewportSize.width,
                            height: viewportSize.height,
                            position: "relative",
                            overflow: "hidden",
                        }}
                    >
                        {imageSrc ? (
                            <img
                                ref={imgRef}
                                alt="Crop"
                                src={imageSrc}
                                onLoad={handleImageLoad}
                                onError={handleImageError}
                                draggable={false}
                                style={{
                                    position: "absolute",
                                    left: 0,
                                    top: 0,
                                    width: naturalSize.width,
                                    height: naturalSize.height,
                                    transform: `translate(${transform.translateX}px, ${transform.translateY}px) scale(${transform.scale}) rotate(${rotation}deg)`,
                                    transformOrigin: "0 0",
                                    touchAction: "none",
                                    userSelect: "none",
                                    pointerEvents: "none",
                                }}
                            />
                        ) : null}
                    </div>
                ) : imageSrc ? (
                    <img
                        ref={imgRef}
                        alt="Crop"
                        src={imageSrc}
                        onLoad={handleImageLoad}
                        onError={handleImageError}
                        draggable={false}
                        style={{
                            maxWidth: "100%",
                            maxHeight: "100%",
                            transform: `rotate(${rotation}deg) scale(${scaling})`,
                        }}
                    />
                ) : null}
            </CropWrapper>
            {SHOW_CROP_DEBUG && usePanZoom && (
                <div
                    style={{
                        position: "absolute",
                        bottom: 0,
                        left: 0,
                        right: 0,
                        background: "rgba(0,0,0,0.8)",
                        color: "#0f0",
                        fontSize: 11,
                        padding: 4,
                        fontFamily: "monospace",
                        zIndex: 10,
                        pointerEvents: "none",
                    }}
                >
                    viewport: {crop && crop.unit === "px" ? `x=${crop.x.toFixed(0)} y=${crop.y.toFixed(0)} w=${crop.width.toFixed(0)} h=${crop.height.toFixed(0)}` : "—"}
                    {" | "}
                    image: {completedCrop ? `ix=${completedCrop.x.toFixed(0)} iy=${completedCrop.y.toFixed(0)} iw=${completedCrop.width.toFixed(0)} ih=${completedCrop.height.toFixed(0)}` : "—"}
                    {" | "}
                    transform: s={transform.scale.toFixed(3)} tx={transform.translateX.toFixed(0)} ty={transform.translateY.toFixed(0)}
                </div>
            )}
        </div>
    );
};

export default ImageCropControl;