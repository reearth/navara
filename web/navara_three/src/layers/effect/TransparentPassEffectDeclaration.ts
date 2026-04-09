import { Group, Scene } from "three";

import {
  EffectDeclaration,
  type EffectConfig,
  type EffectUpdate,
} from "../../core/EffectDeclaration";
import { RenderPass } from "../../effects";

type LayerDescription = {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  transparent?: {};
};

export type TransparentPassConfig = LayerDescription & EffectConfig;

export type TransparentPassUpdate = LayerDescription & EffectUpdate;

export class TransparentPassEffectDeclaration extends EffectDeclaration<
  TransparentPassConfig,
  TransparentPassUpdate,
  RenderPass
> {
  static key = "transparent";
  static insertAfter = ["ssao", "clouds", "atmosphere", "mrt"];

  light = new Group();
  lightsSyncMap = new Map();

  createPass(): RenderPass {
    // Create render pass for transparent objects
    const scene = new Scene();
    scene.add(this.light);
    scene.add(this.view.scenes.transparent);

    const camera = this.view.camera;

    const pass = new RenderPass(scene, camera);
    pass.clear = false;

    this.view.scenes.light.addEventListener("childadded", ({ child }) => {
      const cloned = child.clone(true);
      this.lightsSyncMap.set(child.id, cloned);
      this.light.add(cloned);
    });
    this.view.scenes.light.addEventListener("childremoved", ({ child }) => {
      this.light.remove(this.lightsSyncMap.get(child.id));
      this.lightsSyncMap.delete(child.id);
    });

    return pass;
  }

  update(_time: number): void {
    // Sync lights
    let i = 0;
    for (const child of this.view.scenes.light.children) {
      this.light.children[i].copy(child, true);
      i++;
    }
  }
}
