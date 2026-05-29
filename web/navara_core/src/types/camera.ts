import type { CameraOrientation as EngineCameraOrientation } from "@navara/engine";

import type { LatLngHeight } from "./unit";
import type { NormalizeWASMClass } from "./utils";

export type CameraOrientation = Partial<
  NormalizeWASMClass<EngineCameraOrientation>
>;

export type CameraPosition = Partial<LatLngHeight> &
  CameraOrientation & {
    /** Distance from the target point (lng/lat/height) along the camera forward direction (meters).
     *  When specified, the camera is placed so its forward ray reaches the target point from this distance.
     *  If `height` is omitted, the target elevation defaults to 0 (sea level). */
    distance?: number;
  };
