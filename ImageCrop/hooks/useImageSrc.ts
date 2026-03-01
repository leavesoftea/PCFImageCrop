import { useEffect } from "react";
import { IInputs } from "../generated/ManifestTypes";
import { Crop, PixelCrop, convertToPixelCrop } from "react-image-crop";
import { blankCrop } from "../types/imageCropTypes";
import { stripQuotes } from "../utils/stringUtils";

/**
 * Custom hook to track the image source and apply crop logic on load or failure.
 * Host validity: data:image/ and length > 200 so Add Image (varBase64) always reclaims.
 * Source order: (1) override+internal (2) hostIsValid -> host (3) internal (4) undefined (empty).
 * When host imageInput changes, index clears override+internal so host wins on next render.
 */
export function useImageSrc(
  context: ComponentFramework.Context<IInputs>,
  imgRef: React.RefObject<HTMLImageElement>,
  defaultCrop: Crop | undefined,
  setCrop: (crop: Crop | undefined) => void,
  setCompletedCrop: (crop: PixelCrop) => void,
  internalImageDataUrl: string | undefined,
  overrideHostImage: boolean
): { imageSrc: string | undefined; isRealImageSource: boolean } {
  const rawContext = stripQuotes(context.parameters.imageInput?.raw || undefined);
  const hostSrc = (rawContext ?? "").trim();
  const hostIsEmpty = hostSrc === "";
  const hostIsValid = !hostIsEmpty && hostSrc.startsWith("data:image/") && hostSrc.length > 200;
  let effectiveSrc: string | undefined;
  if (overrideHostImage && internalImageDataUrl) {
    effectiveSrc = internalImageDataUrl;
  } else if (hostIsValid) {
    effectiveSrc = hostSrc;
  } else if (internalImageDataUrl) {
    effectiveSrc = internalImageDataUrl;
  } else {
    effectiveSrc = undefined;
  }

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

  const isRealImageSource = hostIsValid || !!(overrideHostImage && internalImageDataUrl) || !!internalImageDataUrl;

  return { imageSrc: effectiveSrc, isRealImageSource };
}
