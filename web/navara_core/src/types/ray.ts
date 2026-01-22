import type { Ray as EngineRay } from "@navara/engine-api";

import type { NormalizeWASMClass } from "./utils";

export type Ray = Required<NormalizeWASMClass<EngineRay>>;
