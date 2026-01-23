import type { Plane as EnginePlane } from "@navara/engine-api";

import type { NormalizeWASMClass } from "./utils";

export type Plane = Required<NormalizeWASMClass<EnginePlane>>;
