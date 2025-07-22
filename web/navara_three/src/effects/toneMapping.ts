import { ToneMappingMode, ToneMappingEffect } from "postprocessing";
import type { Camera } from "three";

import { Effect, type EffectOptions } from "./effect";

export { ToneMappingMode } from "postprocessing";

export type ToneMappingOptions = {
  mode?: ToneMappingMode;
} & EffectOptions;

export const DEFAULT_TONE_MAPPING_OPTIONS: Required<ToneMappingOptions> = {
  enabled: false,
  mode: ToneMappingMode.AGX,
};

export class ToneMapping extends Effect<ToneMappingEffect, ToneMappingOptions> {
  constructor(camera: Camera, options?: ToneMappingOptions) {
    super(camera, new ToneMappingEffect(), options);
  }
  protected onMounted(): void {
    if (!this.rawEffect) return;
    this.rawEffect.mode = this.mode;
  }
  get mode() {
    return this.options.mode ?? DEFAULT_TONE_MAPPING_OPTIONS.mode;
  }
  set mode(v: ToneMappingMode) {
    if (this.options.mode === v) return;
    this.options.mode = v;
    if (!this.rawEffect) return;
    this.rawEffect.mode = v;
    this.emit("_needsUpdate");
  }
}
