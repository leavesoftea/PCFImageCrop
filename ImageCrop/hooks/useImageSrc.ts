import { useState, useEffect } from "react";
import { IInputs } from "../generated/ManifestTypes";
import { Crop, PixelCrop, convertToPixelCrop } from "react-image-crop";
import { blankCrop } from "../types/imageCropTypes";
import { stripQuotes } from "../utils/stringUtils";

/**
 * Custom hook to track the image source and apply crop logic on load or failure.
 * Supports an optional drop override: when set (e.g. from drag-and-drop), that source is used until context image changes.
 */
export function useImageSrc(
  context: ComponentFramework.Context<IInputs>,
  imgRef: React.RefObject<HTMLImageElement>,
  defaultCrop: Crop | undefined,
  setCrop: (crop: Crop | undefined) => void,
  setCompletedCrop: (crop: PixelCrop) => void
): { imageSrc: string | undefined; setImageSrcFromDrop: (src: string) => void } {
  const contextSrc = stripQuotes(context.parameters.imageInput?.raw || undefined);
  const [dropOverride, setDropOverride] = useState<string | undefined>(undefined);

  // When host sets a new image, clear drop override so context value is used
  useEffect(() => {
    setDropOverride(undefined);
  }, [context.parameters.imageInput?.raw]);

  const effectiveSrc = dropOverride ?? contextSrc;

  useEffect(() => {
    const img = imgRef.current;
    const fallbackCrop = defaultCrop ?? blankCrop;

    if (!img || !effectiveSrc) {
      if (!effectiveSrc) {
        setCrop(undefined);
        setCompletedCrop(convertToPixelCrop({...blankCrop}, 0,0));
      }
      return;
    }

    const applyCrop = () => {
      if (img.complete && img.naturalWidth > 0) {
        setCrop(defaultCrop);
        setCompletedCrop(
          convertToPixelCrop(fallbackCrop, img.width, img.height)
        );
      } else {
        setCrop(undefined);
        setCompletedCrop({
          unit: "px",
          x: 0,
          y: 0,
          width: 0,
          height: 0
        });
      }
    };

    applyCrop();

    const onLoad = () => applyCrop();
    const onError = () => {
      setCrop(undefined);
      setCompletedCrop(convertToPixelCrop({...blankCrop}, 0,0));
    };

    img.addEventListener("load", onLoad);
    img.addEventListener("error", onError);

    return () => {
      img.removeEventListener("load", onLoad);
      img.removeEventListener("error", onError);
    };
  }, [effectiveSrc, defaultCrop]);

  return { imageSrc: effectiveSrc, setImageSrcFromDrop: setDropOverride };
}
