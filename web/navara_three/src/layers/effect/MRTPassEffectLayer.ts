import type { DepthPackingStrategies, Texture } from "three";
import invariant from "tiny-invariant";

import {
  EffectLayerDeclaration,
  type EffectLayerConfig,
  type EffectLayerUpdate,
} from "../../core/EffectLayerDeclaration";
import { EffectSlotRegistry } from "../../core/EffectSlotRegistry";
import type { ViewContext } from "../../core/ViewContext";
import { CustomRenderPass } from "../../passes";

type LayerDescription = {
  mrt?: {
    debugNormal?: boolean;
  };
};

export type MRTPassConfig = LayerDescription & EffectLayerConfig;

export type MRTPassUpdate = LayerDescription & EffectLayerUpdate;

export class MRTPassEffectLayer extends EffectLayerDeclaration<
  MRTPassConfig,
  MRTPassUpdate,
  CustomRenderPass
> {
  static key = "mrt";
  // No insertAfter/Before - this is typically the first pass

  private config: MRTPassConfig;
  private _slotRegistry = new EffectSlotRegistry();

  constructor(view: ViewContext, config: MRTPassConfig) {
    super(view, config);
    this.config = config;
  }

  createPass(): CustomRenderPass {
    // Create render pass for MRT scene
    const scenes = this.view.scenes;
    const camera = this.view.camera;

    invariant(this.view.globe);

    const pass = new CustomRenderPass(
      scenes,
      camera,
      this.view._privates.meshes,
      this.view.renderPassOrchestrator.effectComposer.inputBuffer,
      this.view.globe,
      {
        debugNormal: !!this.config.mrt?.debugNormal,
      },
    );

    // Expose EffectSlotRegistry to ViewContext for mask computation in MeshLayers
    this.view.effectSlotRegistry = this._slotRegistry;

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

  get effectSlotRegistry(): EffectSlotRegistry {
    return this._slotRegistry;
  }

  get depthBuffer(): Texture | undefined {
    return this.raw?.allDepthCopyPass.texture;
  }

  get depthBufferPacking(): DepthPackingStrategies | undefined {
    return this.raw?.allDepthCopyPass.depthPacking;
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
    this._slotRegistry.clear();
    super.onDestroy();
  }
}
