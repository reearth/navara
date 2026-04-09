import { getExcludedKeys } from "../utils/object";

import type { EffectConfig } from "./EffectDeclaration";
import type { LightConfig } from "./LightDeclaration";
import type { MeshConfig } from "./MeshDeclaration";

export class UnknownTypeError extends Error {
  constructor(config: EffectConfig | MeshConfig | LightConfig) {
    super(
      `Unknown ${config.type} type specified in configuration: ${getExcludedKeys(config, ["type"]).join(", ")}`,
    );
  }
}
