import {
  EffectComposer,
  ToneMappingMode,
  ToneMappingEffect,
} from "postprocessing";
import type { Camera } from "three";

import { Effect, type EffectOptions } from "./effect";

export { ToneMappingMode } from "postprocessing";

export type ToneMappingOptions = {
  mode?: ToneMappingMode;
} & EffectOptions;

export const DEFAULT_TONE_MAPPING_OPTIONS: Required<ToneMappingOptions> = {
  enabled: false,
  mode: ToneMappingMode.AGX,
  index: null,
};

export class ToneMapping extends Effect<ToneMappingEffect, ToneMappingOptions> {
  constructor(
    composer: EffectComposer,
    camera: Camera,
    options?: ToneMappingOptions,
  ) {
    super(composer, camera, ToneMappingEffect, options);
  }
  protected onAdded(): void {
    if (!this.effect) return;
    this.effect.mode = this.mode;
  }
  get mode() {
    return this.options.mode ?? DEFAULT_TONE_MAPPING_OPTIONS.mode;
  }
  set mode(v: ToneMappingMode) {
    if (this.options.mode === v) return;
    this.options.mode = v;
    if (!this.effect) return;
    this.effect.mode = v;
    this.emit("_needsUpdate");
  }
}
