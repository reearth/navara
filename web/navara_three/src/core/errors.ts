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

/**
 * Raised when a config or update names more than one of `geodetic` / `matrix` /
 * `matrixWorld`. They share a single placement slot, so the message is
 * deliberately symmetric — neither argument order implies a winner.
 */
export class ConflictingTransformError extends Error {
  constructor(field: string, conflictsWith: string) {
    super(
      `\`${field}\` cannot be combined with \`${conflictsWith}\`: both define the object's placement. ` +
        `Set only one of them — use \`geodetic\` for geographic placement, or \`matrix\` / \`matrixWorld\` to supply a frame yourself.`,
    );
  }
}
