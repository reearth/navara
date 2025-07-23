import {
  EdgeDetectionMode as PostProcessingEdgeDetectionMode,
  FXAAEffect,
  SMAAEffect,
  SMAAPreset,
} from "postprocessing";
import type { Camera } from "three";

import type { Quality } from "../quality";

import { Effect, type EffectOptions } from "./effect";

export { ToneMappingMode } from "postprocessing";

export type EdgeDetectionMode = "color" | "depth" | "luma";

export type AntialiasOptions = {
  enabled?: boolean;
  quality?: Quality;
  // Using `color` might blur a texture, but `depth` has no effect on a mesh that has no depth.
  edgeDetectionMode?: EdgeDetectionMode;
} & EffectOptions;

export const DEFAULT_ANTIALIAS_OPTIONS: AntialiasOptions = {
  enabled: true,
};

const selectSMAAEdgeDetectionMode = (
  edgeDetectionMode: EdgeDetectionMode | undefined,
) => {
  switch (edgeDetectionMode) {
    case "luma":
      return PostProcessingEdgeDetectionMode.LUMA;
    case "depth":
      return PostProcessingEdgeDetectionMode.DEPTH;
    default:
      return PostProcessingEdgeDetectionMode.COLOR;
  }
};

const selectSMAAPreset = (quality: Quality | undefined) => {
  if (!quality) return SMAAPreset.MEDIUM;
  switch (quality) {
    case "low":
      return SMAAPreset.LOW;
    case "medium":
      return SMAAPreset.MEDIUM;
    case "high":
      return SMAAPreset.HIGH;
    case "ultra":
      return SMAAPreset.ULTRA;
  }
};

export class FXAA extends Effect<FXAAEffect, AntialiasOptions> {
  constructor(camera: Camera, options?: AntialiasOptions) {
    super(camera, new FXAAEffect(), options);
  }
}

export class SMAA extends Effect<SMAAEffect, AntialiasOptions> {
  constructor(camera: Camera, options?: AntialiasOptions) {
    super(camera, new SMAAEffect(), options);
  }

  protected onMounted(): void {
    this.edgeDetectionMode = this.options.edgeDetectionMode;
    this.quality = this.options.quality;
  }

  get quality() {
    return this.options.quality;
  }
  set quality(v: AntialiasOptions["quality"]) {
    if (this.options.quality === v) return;
    this.options.quality = v;

    this.rawEffect.applyPreset(selectSMAAPreset(this.options.quality));

    this.emit("_needsUpdate");
  }

  get edgeDetectionMode() {
    return this.options.edgeDetectionMode;
  }
  set edgeDetectionMode(v: AntialiasOptions["edgeDetectionMode"]) {
    if (this.options.edgeDetectionMode === v) return;
    this.options.edgeDetectionMode = v;

    this.rawEffect.edgeDetectionMaterial.edgeDetectionMode =
      selectSMAAEdgeDetectionMode(this.options.edgeDetectionMode);

    this.emit("_needsUpdate");
  }
}
