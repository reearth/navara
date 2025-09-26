import Fragment from "@shaders/glsl/rainDropEffect.frag.glsl?raw";
import { Effect as PostProcessingEffect, BlendFunction } from "postprocessing";
import { Uniform, Vector2 } from "three";

export type RainDropEffectOptions = {
  opacity?: number;
  dropGridSize?: number;
  timeOffset?: number;
};

export const DEFAULT_RAIN_DROP_EFFECT_OPTIONS: Required<RainDropEffectOptions> =
  {
    opacity: 1,
    dropGridSize: 12,
    timeOffset: 12,
  };

export class RainDropPostEffect extends PostProcessingEffect {
  private readonly dropGridSizeUniform: Uniform;
  private readonly timeOffsetUniform: Uniform;

  constructor(options: RainDropEffectOptions = {}) {
    const uniforms = new Map<string, Uniform>([
      ["time", new Uniform(0)],
      ["resolution", new Uniform(new Vector2())],
      [
        "dropGridSize",
        new Uniform(DEFAULT_RAIN_DROP_EFFECT_OPTIONS.dropGridSize),
      ],
      ["timeOffset", new Uniform(DEFAULT_RAIN_DROP_EFFECT_OPTIONS.timeOffset)],
    ]);

    super("RainDropPostEffect", Fragment, {
      uniforms,
      blendFunction: BlendFunction.NORMAL,
    });

    this.dropGridSizeUniform = uniforms.get("dropGridSize")!;
    this.timeOffsetUniform = uniforms.get("timeOffset")!;

    this.dropGridSize =
      options.dropGridSize ?? DEFAULT_RAIN_DROP_EFFECT_OPTIONS.dropGridSize;
    this.timeOffset =
      options.timeOffset ?? DEFAULT_RAIN_DROP_EFFECT_OPTIONS.timeOffset;

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

  set timeOffset(value: number) {
    this.timeOffsetUniform.value = value;
  }

  get timeOffset(): number {
    return this.timeOffsetUniform.value as number;
  }
}
