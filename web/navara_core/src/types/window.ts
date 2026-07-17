import type { Window as EngineWindow } from "@navaramap/engine";

import type { NormalizeWASMClass } from "./utils";

export type Window = Required<NormalizeWASMClass<EngineWindow>>;
