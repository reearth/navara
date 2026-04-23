import type ThreeView from "../index";

import { DescRegistry } from "./DescRegistry";
import type { LightConfig, LightDesc } from "./LightDesc";
import type { ViewContext } from "./ViewContext";

export type LightDescConstructor = new (
  view: ThreeView,
  ctx: ViewContext,
  config: LightConfig,
) => LightDesc;

export class LightDescRegistry extends DescRegistry<
  LightDescConstructor,
  LightDesc,
  LightConfig
> {
  create(name: string, config: LightConfig): LightDesc {
    const LightClass = this.getConstructor(name);
    if (!LightClass) {
      throw new Error(`Unknown light type: ${name}`);
    }
    return new LightClass(this.view, this.ctx, config);
  }

  /**
   * Find light type from config (alias for findTypeFromConfig for backward compatibility)
   */
  findLightType(config: Record<string, unknown>): string | null {
    return this.findTypeFromConfig(config);
  }
}
