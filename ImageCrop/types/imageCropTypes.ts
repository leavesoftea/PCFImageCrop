import { ReactCropProps, Crop } from "react-image-crop";
import { IInputs } from "../generated/ManifestTypes";

export interface IImageCropControlProps extends Partial<ReactCropProps> {
    /** PCF context object */
    context: ComponentFramework.Context<IInputs>;
    /** Unique instance ID for the control */
    instanceid: string;
    /** Height of the control (number or string) */
    height: number;
    onDragStart: (e: PointerEvent) => void;
    onDragEnd: (e: PointerEvent) => void;
    onCropComplete: (results: string) => void;
    /** Called when zoom multiplier changes (wheel/pinch/host); used to sync ZoomMultiplier output */
    onZoomMultiplierChange?: (value: number) => void;
    /** Called when authoritative "image loaded" state changes (real image decoded or cleared). */
    onImageLoadedChange?: (loaded: boolean) => void;
    /** Called when a drag-drop image loads successfully; host can read droppedImageBase64 and dropToken outputs. */
    onDropSuccess?: (base64: string) => void;
    /** Persisted drag-dropped image (from index); clearing is via clearToken only. */
    internalImageDataUrl?: string | null;
    /** When true, dropped image wins over host imageInput until host image changes or clearToken. */
    overrideHostImage?: boolean;
}

export const blankCrop: Crop = {
  unit: "px",
  x: 0,
  y: 0,
  width: 0,
  height: 0
};