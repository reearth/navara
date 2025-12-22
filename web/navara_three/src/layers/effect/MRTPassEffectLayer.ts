import invariant from "tiny-invariant";

import {
  EffectLayerDeclaration,
  type EffectLayerConfig,
  type EffectLayerUpdate,
} from "../../core/EffectLayerDeclaration";
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
      this.view._privates.drapedMaterials,
      this.view.renderPassOrchestrator.effectComposer.inputBuffer,
      this.view.globe,
      {
        debugNormal: !!this.config.mrt?.debugNormal,
        // Pass PostEffect infrastructure for mask context
        postEffectRegistry: this.view.postEffectRegistry,
      },
    );

    return pass;
  }

  onUpdateConfig(updates: MRTPassUpdate): void {
    super.onUpdateConfig(updates);

    if (!this._instance) return;

    Object.assign(this.config, updates);

    if (updates.mrt?.debugNormal !== undefined) {
      // TODO: Support
    }
  }
}
