import { useState, useEffect } from "react";
import { IInputs } from "../generated/ManifestTypes";

/** enableDragDropLoad (TwoOptions). When true, allows dropping image files onto the control (web only). Default false. */
export function useEnableDragDropLoad(context: ComponentFramework.Context<IInputs>): boolean {
  const get = () => context.parameters.enableDragDropLoad?.raw === true;
  const [value, setValue] = useState<boolean>(get);
  useEffect(() => {
    setValue(get());
  }, [context.parameters.enableDragDropLoad?.raw]);
  return value;
}
