import type { DepthPackingStrategies, Texture } from "three";
import invariant from "tiny-invariant";

import {
  EffectDesc,
  type EffectConfig,
  type EffectUpdate,
} from "../../core/EffectDesc";
import type { ViewContext } from "../../core/ViewContext";
import type ThreeView from "../../index";
import { CustomRenderPass } from "../../passes";

type Description = {
  mrt?: {
    debugNormal?: boolean;
  };
};

export type MRTPassConfig = Description & EffectConfig;

export type MRTPassUpdate = Description & EffectUpdate;

export class MRTPassEffectDesc extends EffectDesc<
  MRTPassConfig,
  MRTPassUpdate,
  CustomRenderPass
> {
  static key = "mrt";
  // No insertAfter/Before - this is typically the first pass

  private config: MRTPassConfig;

  constructor(view: ThreeView, ctx: ViewContext, config: MRTPassConfig) {
    super(view, ctx, config);
    this.config = config;
  }

  createPass(): CustomRenderPass {
    // Create render pass for MRT scene
    const scenes = this.ctx.scenes;
    const camera = this.view.camera.raw;

    invariant(this.view.globe);

    const pass = new CustomRenderPass(
      scenes,
      camera,
      this.ctx.getInputBuffer(),
      this.view.globe,
      {
        debugNormal: !!this.config.mrt?.debugNormal,
      },
    );

    return pass;
  }

  get normalBuffer(): Texture | undefined {
    return this.raw?.gbufferRenderTarget.textures[1];
  }

  get effectIdsBuffer(): Texture | undefined {
    return this.raw?.gbufferRenderTarget.textures[2];
  }

  get emissiveBuffer(): Texture | undefined {
    return this.raw?.gbufferRenderTarget.textures[3];
  }

  get depthBuffer(): Texture | undefined {
    return this.raw?.allDepthCopyPass.texture;
  }

  get depthBufferPacking(): DepthPackingStrategies | undefined {
    return this.raw?.allDepthCopyPass.depthPacking;
  }

  /** 1ch opaque-occlusion mask for Selective Effects (R=1 where occluded). */
  get occlusionMaskBuffer(): Texture | undefined {
    return this.raw?.occlusionMaskPass.texture;
  }

  get globeNormalBuffer(): Texture | undefined {
    return this.raw?.globeNormalCopyPass.texture;
  }

  get globeDepthBuffer(): Texture | undefined {
    return this.raw?.globeDepthCopyPass.texture;
  }

  get globeDepthBufferPacking(): DepthPackingStrategies | undefined {
    return this.raw?.globeDepthCopyPass.depthPacking;
  }

  onUpdateConfig(updates: MRTPassUpdate): void {
    super.onUpdateConfig(updates);

    if (!this._instance) return;

    Object.assign(this.config, updates);

    if (updates.mrt?.debugNormal !== undefined) {
      // TODO: Support
    }
  }

  onDestroy(): void {
    super.onDestroy();
  }
}
