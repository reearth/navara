import { EffectPass } from "postprocessing";
import type { DepthPackingStrategies, Texture } from "three";

export class CustomEffectPass extends EffectPass {
  private customDepthTexture: Texture | null = null;
  private customDepthPacking: DepthPackingStrategies | undefined;

  /**
   * Override setDepthTexture to use custom depth texture if provided.
   */
  setDepthTexture(): void {
    if (this.customDepthTexture) {
      super.setDepthTexture(this.customDepthTexture, this.customDepthPacking);
    }
  }

  setCustomDepthTexture(
    texture: Texture | null,
    depthPacking?: DepthPackingStrategies,
  ): void {
    this.customDepthTexture = texture;
    this.customDepthPacking = depthPacking;
  }

  getCustomDepthTexture(): Texture | null {
    return this.customDepthTexture;
  }
}
