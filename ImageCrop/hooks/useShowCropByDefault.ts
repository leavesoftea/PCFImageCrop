import { useState, useEffect } from "react";
import { IInputs } from "../generated/ManifestTypes";

/**
 * Hook to read the showCropByDefault property (TwoOptions). Default false = crop hidden until user activates (e.g. double-click). True = legacy (crop box visible on load).
 */
export function useShowCropByDefault(context: ComponentFramework.Context<IInputs>): boolean {
  const getShowCropByDefault = () => {
    const raw = context.parameters.showCropByDefault?.raw;
    return raw === true;
  };

  const [showCropByDefault, setShowCropByDefault] = useState<boolean>(getShowCropByDefault());

  useEffect(() => {
    setShowCropByDefault(getShowCropByDefault());
  }, [context.parameters.showCropByDefault?.raw]);

  return showCropByDefault;
}
