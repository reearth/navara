import {
  EffectComposer,
  EdgeDetectionMode as PostProcessingEdgeDetectionMode,
  FXAAEffect,
  SMAAEffect,
  SMAAPreset,
  EffectPass,
} from "postprocessing";
import type { Camera } from "three";

import type { Quality } from "../quality";

import { Pass, type EffectOptions } from "./effect";

export { ToneMappingMode } from "postprocessing";

export type EdgeDetectionMode = "color" | "depth" | "luma";

export type AntialiasOptions = {
  enabled?: boolean;
  effect?: "fxaa" | "smaa";
  quality?: Quality;
  // Using `color` might blur a texture, but `depth` has no effect on a mesh that has no depth.
  edgeDetectionMode?: EdgeDetectionMode;
} & EffectOptions;

export const DEFAULT_ANTIALIAS_OPTIONS: AntialiasOptions = {
  enabled: true,
  effect: "smaa",
};

export const selectAntialiasEffect = (aa: AntialiasOptions | undefined) => {
  if (!aa?.enabled) {
    return;
  }
  const effect = aa.effect ?? DEFAULT_ANTIALIAS_OPTIONS.effect;
  switch (effect) {
    case "fxaa":
      return new FXAAEffect();
    case "smaa":
      // Anti-alias just to the depth to avoid blurring a texture.
      return new SMAAEffect({
        edgeDetectionMode:
          aa.edgeDetectionMode === "depth"
            ? PostProcessingEdgeDetectionMode.DEPTH
            : PostProcessingEdgeDetectionMode.COLOR,
        preset: selectSMAAPreset(aa.quality),
      });
  }
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

export type AntialiasEffects = SMAAEffect | FXAAEffect;

export class Antialias extends Pass<EffectPass, AntialiasOptions> {
  camera: Camera;
  _effect?: AntialiasEffects;

  constructor(
    composer: EffectComposer,
    camera: Camera,
    options?: AntialiasOptions,
  ) {
    const effect = selectAntialiasEffect(options);
    let pass;
    if (effect) {
      pass = new EffectPass(camera, effect);
    }

    super(composer, pass, options);

    this._effect = effect;
    this.camera = camera;
  }

  protected onAdded(): void {
    if (!this.pass || !this.effect) return;
    if (this._effect instanceof SMAAEffect) {
      this.edgeDetectionMode = this.options.edgeDetectionMode;
      this.quality = this.options.quality;
    }
  }

  get enabled() {
    return !!this.options.enabled;
  }
  set enabled(v: boolean) {
    if (this.options.enabled === v) return;
    this.options.enabled = v;

    // Make an effect through setter function.
    this.effect = this.options.effect;

    this.emit("_needsUpdate");
  }

  get effect() {
    return this.options.effect;
  }
  set effect(v: AntialiasOptions["effect"]) {
    this.options.effect = v;
    const effect = selectAntialiasEffect(this.options);
    if (!effect) {
      this.set();
      return;
    }

    this._effect = effect;

    this.set(new EffectPass(this.camera, this._effect));

    if (this._effect instanceof SMAAEffect) {
      // eslint-disable-next-line
      // @ts-ignore -- `load` event isn't defined, but it's actually used: https://github.com/pmndrs/postprocessing/blob/0ae2177da589625a26c0aafa134fbf3f95a5cd20/src/effects/SMAAEffect.js#L159
      this._effect.addEventListener("load", () => {
        this.emit("_needsUpdate");
      });
    } else {
      this.emit("_needsUpdate");
    }
  }

  get quality() {
    return this.options.quality;
  }
  set quality(v: AntialiasOptions["quality"]) {
    if (this.options.quality === v) return;
    this.options.quality = v;

    if (!this._effect || !(this._effect instanceof SMAAEffect)) return;
    this._effect.applyPreset(selectSMAAPreset(this.options.quality));

    this.emit("_needsUpdate");
  }

  get edgeDetectionMode() {
    return this.options.edgeDetectionMode;
  }
  set edgeDetectionMode(v: AntialiasOptions["edgeDetectionMode"]) {
    if (this.options.edgeDetectionMode === v) return;
    this.options.edgeDetectionMode = v;

    if (!this._effect || !(this._effect instanceof SMAAEffect)) return;
    this._effect.edgeDetectionMaterial.edgeDetectionMode =
      selectSMAAEdgeDetectionMode(this.options.edgeDetectionMode);

    this.emit("_needsUpdate");
  }
}
