import { Effect, type EffectEvents, type EffectOptions } from "@navara/three";
import { type Camera } from "three";

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
    const dropLayers =
      mergedOptions.dropLayers ?? DEFAULT_RAIN_DROP_EFFECT_OPTIONS.dropLayers;
    const dropSizeFactor =
      mergedOptions.dropSizeFactor ??
      DEFAULT_RAIN_DROP_EFFECT_OPTIONS.dropSizeFactor;
    const noiseScale =
      mergedOptions.noiseScale ?? DEFAULT_RAIN_DROP_EFFECT_OPTIONS.noiseScale;
    const refractionStrength =
      mergedOptions.refractionStrength ??
      DEFAULT_RAIN_DROP_EFFECT_OPTIONS.refractionStrength;
    const minDropStrength =
      mergedOptions.minDropStrength ??
      DEFAULT_RAIN_DROP_EFFECT_OPTIONS.minDropStrength;
    const dropFadeStart =
      mergedOptions.dropFadeStart ??
      DEFAULT_RAIN_DROP_EFFECT_OPTIONS.dropFadeStart;
    const dropFadeEnd =
      mergedOptions.dropFadeEnd ?? DEFAULT_RAIN_DROP_EFFECT_OPTIONS.dropFadeEnd;
    const dropThresholdFactor =
      mergedOptions.dropThresholdFactor ??
      DEFAULT_RAIN_DROP_EFFECT_OPTIONS.dropThresholdFactor;
    const gridDensityLow =
      mergedOptions.gridDensityLow ??
      DEFAULT_RAIN_DROP_EFFECT_OPTIONS.gridDensityLow;
    const gridDensityHigh =
      mergedOptions.gridDensityHigh ??
      DEFAULT_RAIN_DROP_EFFECT_OPTIONS.gridDensityHigh;
    const jitterStrengthLow =
      mergedOptions.jitterStrengthLow ??
      DEFAULT_RAIN_DROP_EFFECT_OPTIONS.jitterStrengthLow;
    const jitterStrengthHigh =
      mergedOptions.jitterStrengthHigh ??
      DEFAULT_RAIN_DROP_EFFECT_OPTIONS.jitterStrengthHigh;

    this.rawEffect.dropGridSize = dropGridSize;
    this.rawEffect.dropDensity = dropDensity;
    this.rawEffect.dropLayers = dropLayers;
    this.rawEffect.dropSizeFactor = dropSizeFactor;
    this.rawEffect.noiseScale = noiseScale;
    this.rawEffect.refractionStrength = refractionStrength;
    this.rawEffect.minDropStrength = minDropStrength;
    this.rawEffect.dropFadeStart = dropFadeStart;
    this.rawEffect.dropFadeEnd = dropFadeEnd;
    this.rawEffect.dropThresholdFactor = dropThresholdFactor;
    this.rawEffect.gridDensityLow = gridDensityLow;
    this.rawEffect.gridDensityHigh = gridDensityHigh;
    this.rawEffect.jitterStrengthLow = jitterStrengthLow;
    this.rawEffect.jitterStrengthHigh = jitterStrengthHigh;
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
    this.emit("needsUpdate");
  }

  get dropGridSize(): number {
    return (
      this.options.dropGridSize ?? DEFAULT_RAIN_DROP_EFFECT_OPTIONS.dropGridSize
    );
  }

  set dropGridSize(value: number) {
    this.options.dropGridSize = value;
    this.rawEffect.dropGridSize = value;
    this.emit("needsUpdate");
  }

  get dropDensity(): number {
    return (
      this.options.dropDensity ?? DEFAULT_RAIN_DROP_EFFECT_OPTIONS.dropDensity
    );
  }

  set dropDensity(value: number) {
    this.options.dropDensity = value;
    this.rawEffect.dropDensity = value;
    this.emit("needsUpdate");
  }

  get dropLayers(): number {
    return (
      this.options.dropLayers ?? DEFAULT_RAIN_DROP_EFFECT_OPTIONS.dropLayers
    );
  }

  set dropLayers(value: number) {
    this.options.dropLayers = value;
    this.rawEffect.dropLayers = value;
    this.emit("needsUpdate");
  }

  get dropSizeFactor(): number {
    return (
      this.options.dropSizeFactor ??
      DEFAULT_RAIN_DROP_EFFECT_OPTIONS.dropSizeFactor
    );
  }

  set dropSizeFactor(value: number) {
    this.options.dropSizeFactor = value;
    this.rawEffect.dropSizeFactor = value;
    this.emit("needsUpdate");
  }

  get noiseScale(): number {
    return (
      this.options.noiseScale ?? DEFAULT_RAIN_DROP_EFFECT_OPTIONS.noiseScale
    );
  }

  set noiseScale(value: number) {
    this.options.noiseScale = value;
    this.rawEffect.noiseScale = value;
    this.emit("needsUpdate");
  }

  get refractionStrength(): number {
    return (
      this.options.refractionStrength ??
      DEFAULT_RAIN_DROP_EFFECT_OPTIONS.refractionStrength
    );
  }

  set refractionStrength(value: number) {
    this.options.refractionStrength = value;
    this.rawEffect.refractionStrength = value;
    this.emit("needsUpdate");
  }

  get minDropStrength(): number {
    return (
      this.options.minDropStrength ??
      DEFAULT_RAIN_DROP_EFFECT_OPTIONS.minDropStrength
    );
  }

  set minDropStrength(value: number) {
    this.options.minDropStrength = value;
    this.rawEffect.minDropStrength = value;
    this.emit("needsUpdate");
  }

  get dropFadeStart(): number {
    return (
      this.options.dropFadeStart ??
      DEFAULT_RAIN_DROP_EFFECT_OPTIONS.dropFadeStart
    );
  }

  set dropFadeStart(value: number) {
    this.options.dropFadeStart = value;
    this.rawEffect.dropFadeStart = value;
    this.emit("needsUpdate");
  }

  get dropFadeEnd(): number {
    return (
      this.options.dropFadeEnd ?? DEFAULT_RAIN_DROP_EFFECT_OPTIONS.dropFadeEnd
    );
  }

  set dropFadeEnd(value: number) {
    this.options.dropFadeEnd = value;
    this.rawEffect.dropFadeEnd = value;
    this.emit("needsUpdate");
  }

  get dropThresholdFactor(): number {
    return (
      this.options.dropThresholdFactor ??
      DEFAULT_RAIN_DROP_EFFECT_OPTIONS.dropThresholdFactor
    );
  }

  set dropThresholdFactor(value: number) {
    this.options.dropThresholdFactor = value;
    this.rawEffect.dropThresholdFactor = value;
    this.emit("needsUpdate");
  }

  get gridDensityLow(): number {
    return (
      this.options.gridDensityLow ??
      DEFAULT_RAIN_DROP_EFFECT_OPTIONS.gridDensityLow
    );
  }

  set gridDensityLow(value: number) {
    this.options.gridDensityLow = value;
    this.rawEffect.gridDensityLow = value;
    this.emit("needsUpdate");
  }

  get gridDensityHigh(): number {
    return (
      this.options.gridDensityHigh ??
      DEFAULT_RAIN_DROP_EFFECT_OPTIONS.gridDensityHigh
    );
  }

  set gridDensityHigh(value: number) {
    this.options.gridDensityHigh = value;
    this.rawEffect.gridDensityHigh = value;
    this.emit("needsUpdate");
  }

  get jitterStrengthLow(): number {
    return (
      this.options.jitterStrengthLow ??
      DEFAULT_RAIN_DROP_EFFECT_OPTIONS.jitterStrengthLow
    );
  }

  set jitterStrengthLow(value: number) {
    this.options.jitterStrengthLow = value;
    this.rawEffect.jitterStrengthLow = value;
    this.emit("needsUpdate");
  }

  get jitterStrengthHigh(): number {
    return (
      this.options.jitterStrengthHigh ??
      DEFAULT_RAIN_DROP_EFFECT_OPTIONS.jitterStrengthHigh
    );
  }

  set jitterStrengthHigh(value: number) {
    this.options.jitterStrengthHigh = value;
    this.rawEffect.jitterStrengthHigh = value;
    this.emit("needsUpdate");
  }
}
