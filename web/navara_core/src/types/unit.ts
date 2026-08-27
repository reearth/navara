import type { LLE } from "@navaramap/engine";

import type { NormalizeWASMClass } from "./utils";

export type XYZ = { x: number; y: number; z: number };
/**
 * Geodetic position: `lat`/`lng` in **degrees**, `height` in meters.
 */
export type LatLngHeight = Required<NormalizeWASMClass<LLE>>;
/** Geodetic position: `lat`/`lng` in **degrees**. */
export type LatLng = Omit<LatLngHeight, "height">;
