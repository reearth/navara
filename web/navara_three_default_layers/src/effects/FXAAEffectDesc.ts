import {
  EffectDesc,
  type EffectConfig,
  type EffectUpdate,
} from "@navara/three";

import { FXAA } from "./aa";

type Description = {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  fxaa?: {};
};

export type FXAAConfig = Description & EffectConfig;

export type FXAAUpdate = Description & EffectUpdate;

export class FXAAEffectDesc extends EffectDesc<
  FXAAConfig,
  FXAAUpdate,
  FXAA
> {
  static key = "fxaa";
  // FXAA should typically be one of the last effects
  static insertBefore = ["final"];

  createPass() {
    const camera = this.view.camera.raw;

    if (!camera) {
      throw new Error("Camera not available for FXAA effect");
    }

    return new FXAA(camera);
  }
}
