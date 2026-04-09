import {
  EffectDeclaration,
  type EffectConfig,
} from "./EffectDeclaration";
import { Registry } from "./Registry";
import type { ViewContext } from "./ViewContext";

export type EffectConstructor = new (
  view: ViewContext,
  config: EffectConfig,
) => EffectDeclaration;

export class EffectRegistry extends Registry<
  EffectConstructor,
  EffectDeclaration
> {
  create(
    effectType: string,
    config: EffectConfig,
  ): EffectDeclaration {
    const EffectClass = this.getConstructor(effectType);
    if (!EffectClass) {
      throw new Error(`Unknown effect type: ${effectType}`);
    }
    return new EffectClass(this.view, config);
  }

  /**
   * Find mesh type from config (alias for findTypeFromConfig for backward compatibility)
   */
  findEffectType(config: Record<string, unknown>): string | null {
    return this.findTypeFromConfig(config);
  }
}
