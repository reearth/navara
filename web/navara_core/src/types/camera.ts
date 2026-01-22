import type { CameraOrientation as EngineCameraOrientation } from "@navara/engine";

import type { LatLngHeight } from "./unit";
import type { NormalizeWASMClass } from "./utils";

export type CameraOrientation = Partial<
  NormalizeWASMClass<EngineCameraOrientation>
>;

export type CameraPosition = Partial<LatLngHeight> & CameraOrientation;
