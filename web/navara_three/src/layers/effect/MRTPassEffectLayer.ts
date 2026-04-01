import type { DepthPackingStrategies, Texture } from "three";
import invariant from "tiny-invariant";

import {
  EffectLayerDeclaration,
  type EffectLayerConfig,
  type EffectLayerUpdate,
} from "../../core/EffectLayerDeclaration";
import { EffectSlotRegistry } from "../../core/EffectSlotRegistry";
import type { ViewContext } from "../../core/ViewContext";
import {
  CustomRenderPass,
  EmissiveBufferPass,
  EffectIdsBufferPass,
} from "../../passes";

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
  private emissiveBufferPass?: EmissiveBufferPass;
  private effectIdsBufferPass?: EffectIdsBufferPass;
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

    const renderer =
      this.view.renderPassOrchestrator.effectComposer.getRenderer();

    const pass = new CustomRenderPass(
      scenes,
      camera,
      this.view._privates.meshes,
      this.view.renderPassOrchestrator.effectComposer.inputBuffer,
      this.view.globe,
      {
        debugNormal: !!this.config.mrt?.debugNormal,
        // Pass SelectiveEffect infrastructure for mask context
        selectiveEffectRegistry: this.view.selectiveEffectRegistry,
      },
    );

    // Create EmissiveBufferPass (independent RT, PickHelper pattern)
    this.emissiveBufferPass = new EmissiveBufferPass(
      renderer,
      camera,
      scenes,
      this.view._privates.meshes,
      this.view.renderPassOrchestrator.effectComposer.inputBuffer,
      this.view.globe,
    );
    pass.emissiveBufferPass = this.emissiveBufferPass;

    // Create EffectIdsBufferPass (independent RT, PickHelper pattern)
    this.effectIdsBufferPass = new EffectIdsBufferPass(
      renderer,
      camera,
      scenes,
      this.view._privates.meshes,
      this.view.renderPassOrchestrator.effectComposer.inputBuffer,
      this.view.globe,
      this._slotRegistry,
    );
    pass.effectIdsBufferPass = this.effectIdsBufferPass;

    return pass;
  }

  get normalBuffer(): Texture | undefined {
    return this.raw?.gbufferRenderTarget.textures[1];
  }

  get emissiveBuffer(): Texture | undefined {
    return this.emissiveBufferPass?.texture;
  }

  get effectIdsBuffer(): Texture | undefined {
    return this.effectIdsBufferPass?.texture;
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
    this.emissiveBufferPass?.dispose();
    this.effectIdsBufferPass?.dispose();
    this._slotRegistry.clear();
    super.onDestroy();
  }
}
