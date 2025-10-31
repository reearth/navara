import { DepthOfFieldEffect, BlendFunction } from "postprocessing";
import type { Camera } from "three";

import { Effect, type EffectOptions } from "./effect";

export type DepthOfFieldOptions = {
  blendFunction?: BlendFunction;
  focusDistance?: number;
  // focusRange?: number;
  focalLength?: number;
  bokehScale?: number;
} & EffectOptions;

export const DEFAULT_DEPTH_OF_FIELD_OPTIONS: Required<DepthOfFieldOptions> = {
  enabled: false,
  blendFunction: BlendFunction.NORMAL,
  focusDistance: 0,
  focalLength: 0,
  bokehScale: 3,
};

export class DepthOfField extends Effect<DepthOfFieldEffect, DepthOfFieldOptions> {

  constructor(camera: Camera, options?: DepthOfFieldOptions) {
    super(camera, new DepthOfFieldEffect(), options);
  }

  protected onMounted(): void {
    if (!this.rawEffect) return;
    this.rawEffect.blendMode.blendFunction = this.options.blendFunction ?? DEFAULT_DEPTH_OF_FIELD_OPTIONS.blendFunction;
    this.rawEffect.cocMaterial.uniforms.focusDistance.value = this.options.focusDistance ?? DEFAULT_DEPTH_OF_FIELD_OPTIONS.focusDistance;
    this.rawEffect.cocMaterial.uniforms.focalLength.value = this.options.focalLength ?? DEFAULT_DEPTH_OF_FIELD_OPTIONS.focalLength;
    this.rawEffect.bokehScale = this.options.bokehScale ?? DEFAULT_DEPTH_OF_FIELD_OPTIONS.bokehScale;
  }

  get blendFunction() {
    return this.options.blendFunction ?? DEFAULT_DEPTH_OF_FIELD_OPTIONS.blendFunction;
  }

  set blendFunction(v: BlendFunction) {
    if (this.options.blendFunction === v) return;
    this.options.blendFunction = v;
    if (!this.rawEffect) return;
    this.rawEffect.blendMode.blendFunction = v;
    this.emit("_needsUpdate");
  }

  get focusDistance() {
    return this.options.focusDistance ?? DEFAULT_DEPTH_OF_FIELD_OPTIONS.focusDistance;
  }

  set focusDistance(v: number) {
    if (this.options.focusDistance === v) return;
    this.options.focusDistance = v;
    if (!this.rawEffect) return;
    this.rawEffect.cocMaterial.uniforms.focusDistance.value = v;
    this.emit("_needsUpdate");
  }

  get focalLength() {
    return this.options.focalLength ?? DEFAULT_DEPTH_OF_FIELD_OPTIONS.focalLength;
  }

  set focalLength(v: number) {
    if (this.options.focalLength === v) return;
    this.options.focalLength = v;
    if (!this.rawEffect) return;
    this.rawEffect.cocMaterial.uniforms.focalLength.value = v;
    this.emit("_needsUpdate");
  }

  get bokehScale() {
    return this.options.bokehScale ?? DEFAULT_DEPTH_OF_FIELD_OPTIONS.bokehScale;
  }

  set bokehScale(v: number) {
    if (this.options.bokehScale === v) return;
    this.options.bokehScale = v;
    if (!this.rawEffect) return;
    this.rawEffect.bokehScale = v;
    this.emit("_needsUpdate");
  }
}
