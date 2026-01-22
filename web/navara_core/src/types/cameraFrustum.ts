import type { CameraFrustum as EngineCameraFrustum } from "@navara/engine-api";

import type { NormalizeWASMClass } from "./utils";

export type CameraFrustum = Required<NormalizeWASMClass<EngineCameraFrustum>>;
