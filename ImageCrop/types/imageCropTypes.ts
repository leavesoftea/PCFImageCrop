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
}

export const blankCrop: Crop = {
  unit: "px",
  x: 0,
  y: 0,
  width: 0,
  height: 0
};