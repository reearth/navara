import type { Vec2 as EngineVec2, Vec3 as EngineVec3 } from "@navara/engine-api";

import type { NormalizeWASMClass } from "./utils";

export type Vec2 = Required<NormalizeWASMClass<EngineVec2>>;
export type Vec3 = Required<NormalizeWASMClass<EngineVec3>>;
