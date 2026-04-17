import type ThreeView from "../index";

import {
  EffectDesc,
  type EffectConfig,
} from "./EffectDesc";
import { LayerRegistry } from "./LayerRegistry";
import type { ViewContext } from "./ViewContext";

export type EffectLayerConstructor = new (
  view: ThreeView,
  ctx: ViewContext,
  config: EffectConfig,
) => EffectDesc;

export class EffectLayerRegistry extends LayerRegistry<
  EffectLayerConstructor,
  EffectDesc
> {
  create(
    effectType: string,
    config: EffectConfig,
  ): EffectDesc {
    const EffectClass = this.getConstructor(effectType);
    if (!EffectClass) {
      throw new Error(`Unknown effect type: ${effectType}`);
    }
    return new EffectClass(this.view, this.ctx, config);
  }

  /**
   * Find mesh type from config (alias for findTypeFromConfig for backward compatibility)
   */
  findEffectType(config: Record<string, unknown>): string | null {
    return this.findTypeFromConfig(config);
  }
}
