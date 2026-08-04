import { Group, Scene } from "three";

import {
  EffectDesc,
  type EffectConfig,
  type EffectUpdate,
} from "../../core/EffectDesc";
import { RenderPass } from "../../effects";

type Description = {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  transparent?: {};
};

export type TransparentPassConfig = Description & EffectConfig;

export type TransparentPassUpdate = Description & EffectUpdate;

export class TransparentPassEffectDesc extends EffectDesc<
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
    scene.add(this.ctx.scenes.transparent);

    const camera = this.view.camera.raw;

    const pass = new RenderPass(scene, camera);
    pass.clear = false;

    this.ctx.scenes.light.addEventListener("childadded", ({ child }) => {
      const cloned = child.clone(true);
      this.lightsSyncMap.set(child.id, cloned);
      this.light.add(cloned);
    });
    this.ctx.scenes.light.addEventListener("childremoved", ({ child }) => {
      this.light.remove(this.lightsSyncMap.get(child.id));
      this.lightsSyncMap.delete(child.id);
    });

    return pass;
  }

  update(_time: number): void {
    // Sync each clone from its source by id — the children order of
    // scenes.light is not stable (e.g. the CSM lights are kept first for
    // shadow-index ordering), so an index-based pairing would copy across
    // mismatched light types.
    for (const child of this.ctx.scenes.light.children) {
      this.lightsSyncMap.get(child.id)?.copy(child, true);
    }
  }
}
