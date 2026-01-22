import type { Transform as EngineTransform } from "@navara/engine-api";

import type { NormalizeWASMClass } from "./utils";

export type Transform = Required<NormalizeWASMClass<EngineTransform>>;
