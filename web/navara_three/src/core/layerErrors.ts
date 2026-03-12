import { getExcludedKeys } from "../utils/object";

import type { EffectLayerConfig } from "./EffectLayerDeclaration";
import type { LightLayerConfig } from "./LightLayerDeclaration";
import type { MeshLayerConfig } from "./MeshLayerDeclaration";

export class UnknownLayerTypeError extends Error {
  constructor(config: EffectLayerConfig | MeshLayerConfig | LightLayerConfig) {
    super(
      `Unknown ${config.type} type specified in configuration: ${getExcludedKeys(config, ["type"]).join(", ")}`,
    );
  }
}
