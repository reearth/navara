import {
  EffectLayerDeclaration,
  type EffectLayerConfig,
  type EffectLayerUpdate,
} from "../../core/EffectLayerDeclaration";
import { RenderPass } from "../../effects";

type LayerDescription = {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  transparent?: {};
};

export type TransparentPassConfig = LayerDescription & EffectLayerConfig;

export type TransparentPassUpdate = LayerDescription & EffectLayerUpdate;

export class TransparentPassEffectLayer extends EffectLayerDeclaration<
  TransparentPassConfig,
  TransparentPassUpdate,
  RenderPass
> {
  static key = "transparent";
  static insertAfter = ["ssao", "clouds", "atmosphere"];

  createPass(): RenderPass {
    // Create render pass for transparent objects
    const scene = this.view.scenes.transparent;
    const camera = this.view.camera;

    const pass = new RenderPass(scene, camera);
    pass.clear = false;

    return pass;
  }
}
