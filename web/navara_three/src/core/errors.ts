import { getExcludedKeys } from "../utils/object";

import type { EffectConfig } from "./EffectDesc";
import type { LightConfig } from "./LightDesc";
import type { MeshConfig } from "./MeshDesc";

export class UnknownTypeError extends Error {
  constructor(config: EffectConfig | MeshConfig | LightConfig) {
    super(
      `Unknown ${config.type} type specified in configuration: ${getExcludedKeys(config, ["type"]).join(", ")}`,
    );
  }
}
