import type { Nullable } from "@navara/core";
import { N8AOPostPass, type QualityMode } from "n8ao";
import { Color, type Camera, type Scene } from "three";

import { Pass, type EffectOptions } from "./effect";

export { ToneMappingMode } from "postprocessing";

export { type QualityMode as SSAOQualityMode } from "n8ao";

export type SSAOOptions = {
  samples?: Nullable<number>;
  radius?: Nullable<number>;
  intensity?: number;
  color?: Color;
  halfRes?: Nullable<boolean>;
  quality?: QualityMode;
} & EffectOptions;

export const DEFAULT_SSAO_OPTIONS: Required<SSAOOptions> = {
  enabled: false,
  samples: null,
  radius: null,
  intensity: 1,
  color: new Color(0),
  index: null,
  halfRes: false,
  quality: "Medium",
};

export class SSAO extends Pass<N8AOPostPass, unknown, SSAOOptions> {
  scene: Scene;
  camera: Camera;
  width: number;
  height: number;

  constructor(
    scene: Scene,
    camera: Camera,
    width: number,
    height: number,
    options?: SSAOOptions,
  ) {
    const pass = new N8AOPostPass(scene, camera, width, height);
    super(pass, options);

    this.scene = scene;
    this.camera = camera;
    this.width = width;
    this.height = height;
  }

  protected onMounted(): void {
    if (!this.rawPass) return;

    const quality = this.quality;
    this.quality = quality;

    if (this.options.samples) {
      this.samples = this.options.samples;
    }
    if (this.options.radius) {
      this.radius = this.options.radius;
    }
    if (this.options.halfRes != null) {
      this.halfRes = this.options.halfRes;
    }

    const intensity = this.intensity;
    this.intensity = intensity;
    const color = this.color;
    this.color = color;

    this.rawPass.configuration.gammaCorrection = false;
    // Navara manages transparency.
    this.rawPass.autoDetectTransparency = false;
  }

  get quality() {
    return this.options.quality ?? DEFAULT_SSAO_OPTIONS.quality;
  }
  set quality(v: QualityMode) {
    if (this.options.quality === v) return;
    this.options.quality = v;

    if (!this.rawPass) return;
    this.rawPass.setQualityMode(v);

    this.emit("_needsUpdate");
  }
  get halfRes() {
    return this.options.halfRes ?? !!DEFAULT_SSAO_OPTIONS.halfRes;
  }
  set halfRes(v: boolean) {
    if (this.options.halfRes === v) return;
    this.options.halfRes = v;

    if (!this.rawPass) return;
    this.rawPass.configuration.halfRes = v;

    this.emit("_needsUpdate");
  }
  get samples() {
    return this.options.samples ?? DEFAULT_SSAO_OPTIONS.samples;
  }
  set samples(v: Nullable<number>) {
    if (this.options.samples === v) return;
    this.options.samples = v;

    if (!this.rawPass) return;
    this.rawPass.configuration.aoSamples =
      v ?? this.rawPass.configuration.aoSamples;

    this.emit("_needsUpdate");
  }
  get radius() {
    return this.options.radius ?? DEFAULT_SSAO_OPTIONS.radius;
  }
  set radius(v: Nullable<number>) {
    if (this.options.radius === v) return;
    this.options.radius = v;

    if (!this.rawPass) return;
    this.rawPass.configuration.aoRadius =
      v ?? this.rawPass.configuration.aoRadius;

    this.emit("_needsUpdate");
  }
  get intensity() {
    return this.options.intensity ?? DEFAULT_SSAO_OPTIONS.intensity;
  }
  set intensity(v: number) {
    if (this.options.intensity === v) return;
    this.options.intensity = v;

    if (!this.rawPass) return;
    this.rawPass.configuration.intensity = v;

    this.emit("_needsUpdate");
  }
  get color() {
    return this.options.color ?? DEFAULT_SSAO_OPTIONS.color;
  }
  set color(v: Color) {
    if (this.options.color === v) return;
    this.options.color = v;

    if (!this.rawPass) return;
    this.rawPass.configuration.color = v;

    this.emit("_needsUpdate");
  }
}
