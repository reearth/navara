import type { Transform as EngineTransform } from "@navaramap/engine-api";

import type { NormalizeWASMClass } from "./utils";

export type Transform = Required<NormalizeWASMClass<EngineTransform>>;
