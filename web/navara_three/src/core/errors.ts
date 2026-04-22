import { getExcludedKeys } from "../utils/object";

import type { EffectConfig } from "./EffectDesc";
import type { LightConfig } from "./LightDesc";
import type { MeshConfig } from "./MeshDesc";

export class UnknownTypeError extends Error {
  constructor(
    type: Exclude<(EffectConfig | MeshConfig | LightConfig)["type"], undefined>,
    config: EffectConfig | MeshConfig | LightConfig,
  ) {
    super(
      `Unknown ${type} type specified in configuration: ${getExcludedKeys(config, ["type"]).join(", ")}`,
    );
  }
}
