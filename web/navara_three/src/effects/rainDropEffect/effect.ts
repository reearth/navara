import { type Camera } from "three";

import { Effect, type EffectEvents, type EffectOptions } from "../effect";

import {
  RainDropPostEffect,
  type RainDropEffectOptions,
  DEFAULT_RAIN_DROP_EFFECT_OPTIONS,
} from "./RainDropPostEffect";

export type RainDropEvents = EffectEvents;

export type RainDropOptions = RainDropEffectOptions & EffectOptions;

export const DEFAULT_RAIN_DROP_OPTIONS: RainDropOptions = {
  ...DEFAULT_RAIN_DROP_EFFECT_OPTIONS,
  enabled: true,
};

export class RainDropEffect extends Effect<
  RainDropPostEffect,
  RainDropOptions,
  RainDropEvents
> {
  constructor(camera: Camera, options?: RainDropOptions) {
    const mergedOptions: RainDropOptions = {
      ...DEFAULT_RAIN_DROP_OPTIONS,
      ...options,
    };
    super(camera, new RainDropPostEffect(mergedOptions), mergedOptions);

    const dropGridSize =
      mergedOptions.dropGridSize ??
      DEFAULT_RAIN_DROP_EFFECT_OPTIONS.dropGridSize;
    const dropDensity =
      mergedOptions.dropDensity ?? DEFAULT_RAIN_DROP_EFFECT_OPTIONS.dropDensity;

    this.rawEffect.dropGridSize = dropGridSize;
    this.rawEffect.dropDensity = dropDensity;
  }

  protected onMounted(): void {}

  update(time: number): void {
    if (this.rawEffect) {
      this.rawEffect.updateTime(time);
    }
  }

  get opacity(): number {
    return this.options.opacity ?? DEFAULT_RAIN_DROP_EFFECT_OPTIONS.opacity;
  }
  set opacity(v: number) {
    this.options.opacity = v;
    this.rawEffect.blendMode.opacity.value = v;
    this.emit("_needsUpdate");
  }

  get dropGridSize(): number {
    return (
      this.options.dropGridSize ?? DEFAULT_RAIN_DROP_EFFECT_OPTIONS.dropGridSize
    );
  }

  set dropGridSize(value: number) {
    this.options.dropGridSize = value;
    this.rawEffect.dropGridSize = value;
    this.emit("_needsUpdate");
  }

  get dropDensity(): number {
    return (
      this.options.dropDensity ?? DEFAULT_RAIN_DROP_EFFECT_OPTIONS.dropDensity
    );
  }

  set dropDensity(value: number) {
    this.options.dropDensity = value;
    this.rawEffect.dropDensity = value;
    this.emit("_needsUpdate");
  }
}
