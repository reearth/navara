import {
  LensFlareEffect,
  lensFlareEffectOptionsDefaults,
} from "@takram/three-geospatial-effects";
import type { Camera } from "three";

import { Effect, type EffectOptions } from "./effect";

export { ToneMappingMode } from "postprocessing";

export type LensFlareOptions = {
  intensity?: number;
} & EffectOptions;

export const DEFAULT_LENS_FLARE_OPTIONS: Required<LensFlareOptions> = {
  enabled: false,
  intensity: lensFlareEffectOptionsDefaults.intensity,
};

export class LensFlare extends Effect<LensFlareEffect, LensFlareOptions> {
  constructor(camera: Camera, options?: LensFlareOptions) {
    super(camera, new LensFlareEffect(), options);
  }

  protected onMounted(): void {
    if (!this.rawEffect) return;
    this.rawEffect.intensity = this.intensity;
  }

  get intensity() {
    return this.options.intensity ?? DEFAULT_LENS_FLARE_OPTIONS.intensity;
  }
  set intensity(v: number) {
    if (this.options.intensity === v) return;
    this.options.intensity = v;
    if (!this.rawEffect) return;
    this.rawEffect.intensity = v;
    this.emit("_needsUpdate");
  }
}
