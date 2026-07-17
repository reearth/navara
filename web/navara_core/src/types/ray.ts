import type { Ray as EngineRay } from "@navaramap/engine-api";

import type { NormalizeWASMClass } from "./utils";

export type Ray = Required<NormalizeWASMClass<EngineRay>>;
