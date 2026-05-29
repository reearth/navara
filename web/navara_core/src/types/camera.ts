import type { CameraOrientation as EngineCameraOrientation } from "@navara/engine";

import type { LatLngHeight } from "./unit";
import type { NormalizeWASMClass } from "./utils";

export type CameraOrientation = Partial<
  NormalizeWASMClass<EngineCameraOrientation>
>;

export type CameraPosition = Partial<LatLngHeight> &
  CameraOrientation & {
    /** Distance from the ellipsoid surface along the camera forward direction (meters).
     *  When specified, `height` is ignored and the camera is placed so its forward ray
     *  intersects the ellipsoid at the given lng/lat from this distance. */
    distance?: number;
  };
