import type { Window as EngineWindow } from "@navara/engine";

import type { NormalizeWASMClass } from "./utils";

export type Window = Required<NormalizeWASMClass<EngineWindow>>;
