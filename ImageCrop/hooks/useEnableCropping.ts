import { useState, useEffect } from "react";
import { IInputs } from "../generated/ManifestTypes";

/** enableCropping (TwoOptions). Default false = cropping off until host enables it. */
export function useEnableCropping(context: ComponentFramework.Context<IInputs>): boolean {
  const get = () => context.parameters.enableCropping?.raw === true;
  const [value, setValue] = useState<boolean>(get);
  useEffect(() => {
    setValue(get());
  }, [context.parameters.enableCropping?.raw]);
  return value;
}
