import { N8AOPostPass } from "n8ao";
import { EffectComposer } from "postprocessing";
import { Color, type Camera, type Scene } from "three";

import { Pass, type EffectOptions } from "./effect";

export { ToneMappingMode } from "postprocessing";

export type SSAOOptions = {
  samples?: number;
  radius?: number;
  intensity?: number;
  color?: Color;
} & EffectOptions;

export const DEFAULT_SSAO_OPTIONS: Required<SSAOOptions> = {
  enabled: false,
  samples: 16,
  radius: 5,
  intensity: 1,
  color: new Color(0),
  index: null,
};

export class SSAO extends Pass<N8AOPostPass, SSAOOptions> {
  scene: Scene;
  camera: Camera;
  width: number;
  height: number;

  constructor(
    composer: EffectComposer,
    scene: Scene,
    camera: Camera,
    width: number,
    height: number,
    options?: SSAOOptions,
  ) {
    const pass = options?.enabled
      ? new N8AOPostPass(scene, camera, width, height)
      : undefined;
    super(composer, pass, options);

    this.scene = scene;
    this.camera = camera;
    this.width = width;
    this.height = height;
  }

  protected onAdded(): void {
    if (!this.pass) return;

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

  protected onMounted(): void {
    this.pass = new N8AOPostPass(
      this.scene,
      this.camera,
      this.width,
      this.height,
    );
  }

  get samples() {
    return this.options.samples ?? DEFAULT_SSAO_OPTIONS.samples;
  }
  set samples(v: number) {
    if (this.options.samples === v) return;
    this.options.samples = v;

    if (!this.pass) return;
    this.pass.configuration.aoSamples = v;

    this.emit("_needsUpdate");
  }
  get radius() {
    return this.options.radius ?? DEFAULT_SSAO_OPTIONS.radius;
  }
  set radius(v: number) {
    if (this.options.radius === v) return;
    this.options.radius = v;

    if (!this.pass) return;
    this.pass.configuration.aoRadius = v;

    this.emit("_needsUpdate");
  }
  get intensity() {
    return this.options.intensity ?? DEFAULT_SSAO_OPTIONS.intensity;
  }
  set intensity(v: number) {
    if (this.options.intensity === v) return;
    this.options.intensity = v;

    if (!this.pass) return;
    this.pass.configuration.intensity = v;

    this.emit("_needsUpdate");
  }
  get color() {
    return this.options.color ?? DEFAULT_SSAO_OPTIONS.color;
  }
  set color(v: Color) {
    if (this.options.color === v) return;
    this.options.color = v;

    if (!this.pass) return;
    this.pass.configuration.color = v;

    this.emit("_needsUpdate");
  }
}
