import { useState, useEffect } from "react";
import { IInputs } from "../generated/ManifestTypes";

/** enablePanImage (TwoOptions). Default false = pan disabled until host enables it. */
export function useEnablePanImage(context: ComponentFramework.Context<IInputs>): boolean {
  const get = () => context.parameters.enablePanImage?.raw === true;
  const [value, setValue] = useState<boolean>(get);
  useEffect(() => {
    setValue(get());
  }, [context.parameters.enablePanImage?.raw]);
  return value;
}
