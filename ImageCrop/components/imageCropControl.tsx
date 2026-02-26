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
    useImageViewTransform,
} from "../hooks";
import CropWrapper from "./imageCropWrapper";

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

    // Get the default crop object (not a hook)
    const defaultCrop = useDefaultCrop(pcfContext.context);
    // Get the image from the PCF context property (should be base64)
    const imageSrc = useImageSrc(pcfContext.context, imgRef, defaultCrop, setCrop, setCompletedCrop);

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
    const { transform, panBy, zoomAt, setTransformDirect } = useImageViewTransform(
        viewportSize.width,
        viewportSize.height,
        naturalSize.width,
        naturalSize.height,
        isTransformReady
    );

    const handleImageLoad = React.useCallback(() => {
        const img = imgRef.current;
        if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
            setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
        }
    }, []);

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
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            zoomAt(px, py, delta);
            e.preventDefault();
        },
        [zoomAt, isTransformReady]
    );

    React.useEffect(() => {
        const el = viewportRef.current;
        if (!el) return;
        el.addEventListener("wheel", handleWheel, { passive: false });
        return () => el.removeEventListener("wheel", handleWheel);
    }, [handleWheel]);

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
            } else if (map.size === 1) {
                panRef.current = {
                    startX: e.clientX,
                    startY: e.clientY,
                    startTx: transform.translateX,
                    startTy: transform.translateY,
                };
                pinchRef.current = null;
            }
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
            e.preventDefault();
        },
        [isTransformReady, transform.translateX, transform.translateY, transform.scale]
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
            if (activePointersRef.current.size !== 2) pinchRef.current = null;
        }
        (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    }, []);

    const handlePointerCancel = React.useCallback((e: React.PointerEvent) => {
        activePointersRef.current.delete(e.pointerId);
        panRef.current = null;
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
    // Get the scaling property from PCF context
    const scaling = useScaling(pcfContext.context);
    // Use custom hook to handle crop-to-base64 conversion and callback
    useCropToBase64(imgRef, completedCrop, props.onCropComplete, rotation, scaling, circularCrop);

    const showControl = imageSrc && pcfContext.isVisible();
    const usePanZoom = showControl && isTransformReady;

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
            }}
        >
            <CropWrapper
                crop={crop}
                onChange={(c: Crop) => setCrop(c)}
                onDragStart={(e: PointerEvent) => props.onDragStart(e)}
                onDragEnd={(e: PointerEvent) => props.onDragEnd(e)}
                onComplete={(c: PixelCrop) => setCompletedCrop(c)}
                locked={locked}
                disabled={disabled}
                ruleOfThirds={ruleOfThirds}
                circularCrop={circularCrop}
                minWidth={minWidth}
                maxWidth={maxWidth}
                minHeight={minHeight}
                maxHeight={maxHeight}
                aspect={aspect}
                keepSelection={keepSelection}
                style={{ display: "block", width: "100%", height: "100%", position: "absolute", inset: 0, overflow: "hidden" }}
            >
                <img
                    ref={imgRef}
                    alt="Crop"
                    src={imageSrc}
                    onLoad={handleImageLoad}
                    draggable={false}
                    style={
                        usePanZoom
                            ? {
                                  position: "absolute",
                                  left: 0,
                                  top: 0,
                                  width: naturalSize.width,
                                  height: naturalSize.height,
                                  transform: `translate(${transform.translateX}px, ${transform.translateY}px) scale(${transform.scale}) rotate(${rotation}deg) scale(${scaling})`,
                                  transformOrigin: "0 0",
                                  touchAction: "none",
                                  userSelect: "none",
                                  pointerEvents: "auto",
                              }
                            : {
                                  maxWidth: "100%",
                                  maxHeight: "100%",
                                  transform: `rotate(${rotation}deg) scale(${scaling})`,
                              }
                    }
                    onPointerDown={usePanZoom ? handlePointerDown : undefined}
                    onPointerMove={usePanZoom ? handlePointerMove : undefined}
                    onPointerUp={usePanZoom ? handlePointerUp : undefined}
                    onPointerCancel={usePanZoom ? handlePointerCancel : undefined}
                />
            </CropWrapper>
        </div>
    );
};

export default ImageCropControl;