import type { LLE } from "@navaramap/engine";

import type { NormalizeWASMClass } from "./utils";

export type XYZ = { x: number; y: number; z: number };
export type LatLngHeight = Required<NormalizeWASMClass<LLE>>;
export type LatLng = Omit<LatLngHeight, "height">;
