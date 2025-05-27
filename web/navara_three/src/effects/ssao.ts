import { N8AOPostPass } from "n8ao";
import { EffectComposer } from "postprocessing";
import { Color, type Camera, type Scene } from "three";

import { Pass, type EffectOptions } from "./effect";

export { ToneMappingMode } from "postprocessing";

export type SSAOOptions = {
  samples: number;
  radius: number;
  intensity: number;
  color: Color;
} & EffectOptions;

export const DEFAULT_SSAO_OPTIONS: SSAOOptions = {
  samples: 16,
  radius: 5,
  intensity: 1,
  color: new Color(0),
};

export class SSAO extends Pass<N8AOPostPass, SSAOOptions> {
  constructor(
    composer: EffectComposer,
    scene: Scene,
    camera: Camera,
    width: number,
    height: number,
    options?: SSAOOptions,
  ) {
    super(composer, new N8AOPostPass(scene, camera, width, height), options);

    const samples = this.samples;
    this.samples = samples;
    const radius = this.radius;
    this.radius = radius;
    const intensity = this.intensity;
    this.intensity = intensity;
    const color = this.color;
    this.color = color;

    this.pass.configuration.gammaCorrection = false;
  }
  get samples() {
    return this.options.samples ?? DEFAULT_SSAO_OPTIONS.samples;
  }
  set samples(v: number) {
    if (this.options.samples === v) return;
    this.options.samples = v;
    this.pass.configuration.aoSamples = v;
    this.emit("_needsUpdate");
  }
  get radius() {
    return this.options.radius ?? DEFAULT_SSAO_OPTIONS.radius;
  }
  set radius(v: number) {
    if (this.options.radius === v) return;
    this.options.radius = v;
    this.pass.configuration.aoRadius = v;
    this.emit("_needsUpdate");
  }
  get intensity() {
    return this.options.intensity ?? DEFAULT_SSAO_OPTIONS.intensity;
  }
  set intensity(v: number) {
    if (this.options.intensity === v) return;
    this.options.intensity = v;
    this.pass.configuration.intensity = v;
    this.emit("_needsUpdate");
  }
  get color() {
    return this.options.color ?? DEFAULT_SSAO_OPTIONS.color;
  }
  set color(v: Color) {
    if (this.options.color === v) return;
    this.options.color = v;
    this.pass.configuration.color = v;
    this.emit("_needsUpdate");
  }
}
