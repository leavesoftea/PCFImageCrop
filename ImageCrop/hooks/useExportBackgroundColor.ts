import { useState, useEffect } from "react";
import { IInputs } from "../generated/ManifestTypes";

/**
 * Normalize color from host: treat empty/Transparent as transparent; Power Fx "RGBA(" -> CSS "rgba("; strip surrounding quotes.
 */
function normalizeExportBackgroundColor(raw: string | null | undefined): string {
  if (raw == null || typeof raw !== "string") return "";
  let s = raw.trim();
  if (s === "" || s.toLowerCase() === "transparent") return "";
  // Strip surrounding quotes (backward compat when maker passed a quoted string)
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  if (s === "" || s.toLowerCase() === "transparent") return "";
  // Power Fx uses RGBA(...); CSS uses rgba(...)
  if (s.startsWith("RGBA(")) s = "rgba(" + s.slice(5);
  else if (s.startsWith("Rgb(")) s = "rgb(" + s.slice(4);
  return s;
}

/**
 * Returns the optional export background color (CSS color string). Empty string = transparent export.
 * Accepts Color-typed values from Power Apps (RGBA(), Color.Black, etc.) via string coercion.
 */
export function useExportBackgroundColor(context: ComponentFramework.Context<IInputs>): string {
  const get = () => normalizeExportBackgroundColor(context.parameters.exportBackgroundColor?.raw as string | null | undefined);

  const [value, setValue] = useState<string>(get);

  useEffect(() => {
    setValue(get());
  }, [context.parameters.exportBackgroundColor?.raw]);

  return value;
}
