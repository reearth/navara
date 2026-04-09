import type {
  LightConfig,
  LightDeclaration,
} from "./LightDeclaration";
import { Registry } from "./Registry";
import type { ViewContext } from "./ViewContext";

export type LightConstructor = new (
  view: ViewContext,
  config: LightConfig,
) => LightDeclaration;

export class LightRegistry extends Registry<
  LightConstructor,
  LightDeclaration,
  LightConfig
> {
  create(name: string, config: LightConfig): LightDeclaration {
    const LightClass = this.getConstructor(name);
    if (!LightClass) {
      throw new Error(`Unknown light type: ${name}`);
    }
    return new LightClass(this.view, config);
  }

  /**
   * Find light type from config (alias for findTypeFromConfig for backward compatibility)
   */
  findLightType(config: Record<string, unknown>): string | null {
    return this.findTypeFromConfig(config);
  }
}
