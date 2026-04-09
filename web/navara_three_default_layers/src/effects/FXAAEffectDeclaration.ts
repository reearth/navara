import {
  EffectDeclaration,
  type EffectConfig,
  type EffectUpdate,
} from "@navara/three";

import { FXAA } from "./aa";

type LayerDescription = {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  fxaa?: {};
};

export type FXAAConfig = LayerDescription & EffectConfig;

export type FXAAUpdate = LayerDescription & EffectUpdate;

export class FXAAEffectDeclaration extends EffectDeclaration<
  FXAAConfig,
  FXAAUpdate,
  FXAA
> {
  static key = "fxaa";
  // FXAA should typically be one of the last effects
  static insertBefore = ["final"];

  createPass() {
    const camera = this.view.camera;

    if (!camera) {
      throw new Error("Camera not available for FXAA effect");
    }

    return new FXAA(camera);
  }
}
