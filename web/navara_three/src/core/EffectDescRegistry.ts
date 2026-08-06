import type ThreeView from "../index";
import type { GBufferName } from "../material/gbufferLayout";

import { DescRegistry } from "./DescRegistry";
import { EffectDesc, type EffectConfig } from "./EffectDesc";
import type { ViewContext } from "./ViewContext";

export type EffectDescConstructor = new (
  view: ThreeView,
  ctx: ViewContext,
  config: EffectConfig,
) => EffectDesc;

export class EffectDescRegistry extends DescRegistry<
  EffectDescConstructor,
  EffectDesc
> {
  create(effectType: string, config: EffectConfig): EffectDesc {
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

  /**
   * Optional G-buffer attachments the effect type declares via the
   * `requiredBuffers` static (empty when it declares none).
   */
  getRequiredBuffers(effectType: string): readonly GBufferName[] {
    const EffectClass = this.getConstructor(effectType) as
      | (EffectDescConstructor & {
          requiredBuffers?: readonly GBufferName[];
        })
      | undefined;
    return EffectClass?.requiredBuffers ?? [];
  }
}
