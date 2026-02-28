import { useState, useEffect } from "react";
import { IInputs } from "../generated/ManifestTypes";

/** useShiftToPanImage (TwoOptions). Default false = pan does not require Shift. When true, pan only while Shift is held. */
export function useShiftToPanImage(context: ComponentFramework.Context<IInputs>): boolean {
  const get = () => context.parameters.useShiftToPanImage?.raw === true;
  const [value, setValue] = useState<boolean>(get);
  useEffect(() => {
    setValue(get());
  }, [context.parameters.useShiftToPanImage?.raw]);
  return value;
}
