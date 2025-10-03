import Fragment from "@shaders/glsl/rainDropEffect.frag.glsl?raw";
import { Effect as PostProcessingEffect, BlendFunction } from "postprocessing";
import { Uniform, Vector2 } from "three";

export type RainDropEffectOptions = {
  opacity?: number;
  dropGridSize?: number;
  dropDensity?: number;
};

export const DEFAULT_RAIN_DROP_EFFECT_OPTIONS: Required<RainDropEffectOptions> =
  {
    opacity: 1,
    dropGridSize: 12,
    dropDensity: 1,
  };

export class RainDropPostEffect extends PostProcessingEffect {
  private readonly dropGridSizeUniform: Uniform;
  private readonly dropDensityUniform: Uniform;

  constructor(options: RainDropEffectOptions = {}) {
    const dropGridSizeUniform = new Uniform(
      DEFAULT_RAIN_DROP_EFFECT_OPTIONS.dropGridSize,
    );
    const dropDensityUniform = new Uniform(
      DEFAULT_RAIN_DROP_EFFECT_OPTIONS.dropDensity,
    );

    const uniforms = new Map<string, Uniform>([
      ["time", new Uniform(0)],
      ["resolution", new Uniform(new Vector2())],
      ["dropGridSize", dropGridSizeUniform],
      ["dropDensity", dropDensityUniform],
    ]);

    super("RainDropPostEffect", Fragment, {
      uniforms,
      blendFunction: BlendFunction.NORMAL,
    });

    this.dropGridSizeUniform = dropGridSizeUniform;
    this.dropDensityUniform = dropDensityUniform;

    this.dropGridSize =
      options.dropGridSize ?? DEFAULT_RAIN_DROP_EFFECT_OPTIONS.dropGridSize;
    this.dropDensity =
      options.dropDensity ?? DEFAULT_RAIN_DROP_EFFECT_OPTIONS.dropDensity;

    this.blendMode.opacity.value =
      options.opacity ?? DEFAULT_RAIN_DROP_EFFECT_OPTIONS.opacity;
  }

  setSize(width: number, height: number): void {
    const resolutionUniform = this.uniforms.get("resolution");
    if (resolutionUniform) {
      (resolutionUniform.value as Vector2).set(width, height);
    }
  }

  updateTime(time: number): void {
    const timeUniform = this.uniforms.get("time");
    if (timeUniform) {
      timeUniform.value = time;
    }
  }

  set dropGridSize(value: number) {
    this.dropGridSizeUniform.value = value;
  }

  get dropGridSize(): number {
    return this.dropGridSizeUniform.value as number;
  }

  set dropDensity(value: number) {
    this.dropDensityUniform.value = value;
  }

  get dropDensity(): number {
    return this.dropDensityUniform.value as number;
  }
}
