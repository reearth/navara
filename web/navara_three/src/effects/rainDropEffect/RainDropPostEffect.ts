import Fragment from "@shaders/glsl/rainDropEffect.frag.glsl?raw";
import { Effect as PostProcessingEffect, BlendFunction } from "postprocessing";
import { Uniform, Vector2 } from "three";

/** Optional knobs exposed to whoever constructs the effect. */
export type RainDropEffectOptions = {
  /** Opacity applied after the shader runs, useful for blending the effect. */
  opacity?: number;
  /** Size of the UV grid used to place droplets; larger values yield smaller cells. */
  dropGridSize?: number;
  /** Multiplier applied in the shader to control how many droplets are spawned. */
  dropDensity?: number;
  /** Active number of simulated layers; higher values add small droplets at extra cost. */
  dropLayers?: number;
  /** Controls how tightly droplets are packed by scaling the grid size. */
  dropSizeFactor?: number;
  /** Scales the noise that drives jitter and refraction wobble. */
  noiseScale?: number;
  /** Intensity of UV distortion caused by refraction. */
  refractionStrength?: number;
  /** Minimum strength required before rendering a droplet. */
  minDropStrength?: number;
  /** Fade window (start) for smooth drop visibility. */
  dropFadeStart?: number;
  /** Fade window (end) paired with dropFadeStart. */
  dropFadeEnd?: number;
  /** Base threshold factor controlling spawn probability. */
  dropThresholdFactor?: number;
  /** Adjustment applied when density is low; pairs with gridDensityHigh. */
  gridDensityLow?: number;
  /** Adjustment applied when density is high; pairs with gridDensityLow. */
  gridDensityHigh?: number;
  /** Maximum jitter for sparse drops; pairs with jitterStrengthHigh. */
  jitterStrengthLow?: number;
  /** Minimum jitter for dense drops; pairs with jitterStrengthLow. */
  jitterStrengthHigh?: number;
};

export const DEFAULT_RAIN_DROP_EFFECT_OPTIONS: Required<RainDropEffectOptions> =
  {
    opacity: 1,
    dropGridSize: 12,
    dropDensity: 1,
    dropLayers: 4,
    dropSizeFactor: 0.015,
    noiseScale: 200,
    refractionStrength: 0.3,
    minDropStrength: 0.01,
    dropFadeStart: 0.3,
    dropFadeEnd: 0.8,
    dropThresholdFactor: 0.08,
    gridDensityLow: 1.15,
    gridDensityHigh: 0.85,
    jitterStrengthLow: 0.45,
    jitterStrengthHigh: 0.08,
  };

/**
 * Wraps the GLSL rain drop shader so it can be slotted into the post-processing
 * pipeline with adjustable density, grid size, and opacity.
 */
export class RainDropPostEffect extends PostProcessingEffect {
  private readonly dropGridSizeUniform: Uniform;
  private readonly dropDensityUniform: Uniform;
  private readonly dropLayersUniform: Uniform;
  private readonly dropSizeFactorUniform: Uniform;
  private readonly noiseScaleUniform: Uniform;
  private readonly refractionStrengthUniform: Uniform;
  private readonly minDropStrengthUniform: Uniform;
  private readonly dropFadeStartUniform: Uniform;
  private readonly dropFadeEndUniform: Uniform;
  private readonly dropThresholdFactorUniform: Uniform;
  private readonly gridDensityLowUniform: Uniform;
  private readonly gridDensityHighUniform: Uniform;
  private readonly jitterStrengthLowUniform: Uniform;
  private readonly jitterStrengthHighUniform: Uniform;

  constructor(options: RainDropEffectOptions = {}) {
    const dropGridSizeUniform = new Uniform(
      DEFAULT_RAIN_DROP_EFFECT_OPTIONS.dropGridSize,
    );
    const dropDensityUniform = new Uniform(
      DEFAULT_RAIN_DROP_EFFECT_OPTIONS.dropDensity,
    );
    const dropLayersUniform = new Uniform(
      DEFAULT_RAIN_DROP_EFFECT_OPTIONS.dropLayers,
    );
    const dropSizeFactorUniform = new Uniform(
      DEFAULT_RAIN_DROP_EFFECT_OPTIONS.dropSizeFactor,
    );
    const noiseScaleUniform = new Uniform(
      DEFAULT_RAIN_DROP_EFFECT_OPTIONS.noiseScale,
    );
    const refractionStrengthUniform = new Uniform(
      DEFAULT_RAIN_DROP_EFFECT_OPTIONS.refractionStrength,
    );
    const minDropStrengthUniform = new Uniform(
      DEFAULT_RAIN_DROP_EFFECT_OPTIONS.minDropStrength,
    );
    const dropFadeStartUniform = new Uniform(
      DEFAULT_RAIN_DROP_EFFECT_OPTIONS.dropFadeStart,
    );
    const dropFadeEndUniform = new Uniform(
      DEFAULT_RAIN_DROP_EFFECT_OPTIONS.dropFadeEnd,
    );
    const dropThresholdFactorUniform = new Uniform(
      DEFAULT_RAIN_DROP_EFFECT_OPTIONS.dropThresholdFactor,
    );
    const gridDensityLowUniform = new Uniform(
      DEFAULT_RAIN_DROP_EFFECT_OPTIONS.gridDensityLow,
    );
    const gridDensityHighUniform = new Uniform(
      DEFAULT_RAIN_DROP_EFFECT_OPTIONS.gridDensityHigh,
    );
    const jitterStrengthLowUniform = new Uniform(
      DEFAULT_RAIN_DROP_EFFECT_OPTIONS.jitterStrengthLow,
    );
    const jitterStrengthHighUniform = new Uniform(
      DEFAULT_RAIN_DROP_EFFECT_OPTIONS.jitterStrengthHigh,
    );

    // Each uniform is mirrored in the shader; keep them in sync when adding
    // new controls to the effect.
    const uniforms = new Map<string, Uniform>([
      ["time", new Uniform(0)],
      ["resolution", new Uniform(new Vector2())],
      ["dropGridSize", dropGridSizeUniform],
      ["dropDensity", dropDensityUniform],
      ["dropLayers", dropLayersUniform],
      ["dropSizeFactor", dropSizeFactorUniform],
      ["noiseScale", noiseScaleUniform],
      ["refractionStrength", refractionStrengthUniform],
      ["minDropStrength", minDropStrengthUniform],
      ["dropFadeStart", dropFadeStartUniform],
      ["dropFadeEnd", dropFadeEndUniform],
      ["dropThresholdFactor", dropThresholdFactorUniform],
      ["gridDensityLow", gridDensityLowUniform],
      ["gridDensityHigh", gridDensityHighUniform],
      ["jitterStrengthLow", jitterStrengthLowUniform],
      ["jitterStrengthHigh", jitterStrengthHighUniform],
    ]);

    super("RainDropPostEffect", Fragment, {
      uniforms,
      blendFunction: BlendFunction.NORMAL,
    });

    this.dropGridSizeUniform = dropGridSizeUniform;
    this.dropDensityUniform = dropDensityUniform;
    this.dropLayersUniform = dropLayersUniform;
    this.dropSizeFactorUniform = dropSizeFactorUniform;
    this.noiseScaleUniform = noiseScaleUniform;
    this.refractionStrengthUniform = refractionStrengthUniform;
    this.minDropStrengthUniform = minDropStrengthUniform;
    this.dropFadeStartUniform = dropFadeStartUniform;
    this.dropFadeEndUniform = dropFadeEndUniform;
    this.dropThresholdFactorUniform = dropThresholdFactorUniform;
    this.gridDensityLowUniform = gridDensityLowUniform;
    this.gridDensityHighUniform = gridDensityHighUniform;
    this.jitterStrengthLowUniform = jitterStrengthLowUniform;
    this.jitterStrengthHighUniform = jitterStrengthHighUniform;

    this.dropGridSize =
      options.dropGridSize ?? DEFAULT_RAIN_DROP_EFFECT_OPTIONS.dropGridSize;
    this.dropDensity =
      options.dropDensity ?? DEFAULT_RAIN_DROP_EFFECT_OPTIONS.dropDensity;
    this.dropLayers =
      options.dropLayers ?? DEFAULT_RAIN_DROP_EFFECT_OPTIONS.dropLayers;
    this.dropSizeFactor =
      options.dropSizeFactor ?? DEFAULT_RAIN_DROP_EFFECT_OPTIONS.dropSizeFactor;
    this.noiseScale =
      options.noiseScale ?? DEFAULT_RAIN_DROP_EFFECT_OPTIONS.noiseScale;
    this.refractionStrength =
      options.refractionStrength ??
      DEFAULT_RAIN_DROP_EFFECT_OPTIONS.refractionStrength;
    this.minDropStrength =
      options.minDropStrength ??
      DEFAULT_RAIN_DROP_EFFECT_OPTIONS.minDropStrength;
    this.dropFadeStart =
      options.dropFadeStart ?? DEFAULT_RAIN_DROP_EFFECT_OPTIONS.dropFadeStart;
    this.dropFadeEnd =
      options.dropFadeEnd ?? DEFAULT_RAIN_DROP_EFFECT_OPTIONS.dropFadeEnd;
    this.dropThresholdFactor =
      options.dropThresholdFactor ??
      DEFAULT_RAIN_DROP_EFFECT_OPTIONS.dropThresholdFactor;
    this.gridDensityLow =
      options.gridDensityLow ?? DEFAULT_RAIN_DROP_EFFECT_OPTIONS.gridDensityLow;
    this.gridDensityHigh =
      options.gridDensityHigh ??
      DEFAULT_RAIN_DROP_EFFECT_OPTIONS.gridDensityHigh;
    this.jitterStrengthLow =
      options.jitterStrengthLow ??
      DEFAULT_RAIN_DROP_EFFECT_OPTIONS.jitterStrengthLow;
    this.jitterStrengthHigh =
      options.jitterStrengthHigh ??
      DEFAULT_RAIN_DROP_EFFECT_OPTIONS.jitterStrengthHigh;

    this.blendMode.opacity.value =
      options.opacity ?? DEFAULT_RAIN_DROP_EFFECT_OPTIONS.opacity;
  }

  setSize(width: number, height: number): void {
    const resolutionUniform = this.uniforms.get("resolution");
    if (resolutionUniform) {
      // Updating resolution keeps droplet distortion consistent on resize.
      (resolutionUniform.value as Vector2).set(width, height);
    }
  }

  updateTime(time: number): void {
    const timeUniform = this.uniforms.get("time");
    if (timeUniform) {
      // Drives the animation in the fragment shader.
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

  set dropLayers(value: number) {
    this.dropLayersUniform.value = value;
  }

  get dropLayers(): number {
    return this.dropLayersUniform.value as number;
  }

  set dropSizeFactor(value: number) {
    this.dropSizeFactorUniform.value = value;
  }

  get dropSizeFactor(): number {
    return this.dropSizeFactorUniform.value as number;
  }

  set noiseScale(value: number) {
    this.noiseScaleUniform.value = value;
  }

  get noiseScale(): number {
    return this.noiseScaleUniform.value as number;
  }

  set refractionStrength(value: number) {
    this.refractionStrengthUniform.value = value;
  }

  get refractionStrength(): number {
    return this.refractionStrengthUniform.value as number;
  }

  set minDropStrength(value: number) {
    this.minDropStrengthUniform.value = value;
  }

  get minDropStrength(): number {
    return this.minDropStrengthUniform.value as number;
  }

  set dropFadeStart(value: number) {
    this.dropFadeStartUniform.value = value;
  }

  get dropFadeStart(): number {
    return this.dropFadeStartUniform.value as number;
  }

  set dropFadeEnd(value: number) {
    this.dropFadeEndUniform.value = value;
  }

  get dropFadeEnd(): number {
    return this.dropFadeEndUniform.value as number;
  }

  set dropThresholdFactor(value: number) {
    this.dropThresholdFactorUniform.value = value;
  }

  get dropThresholdFactor(): number {
    return this.dropThresholdFactorUniform.value as number;
  }

  set gridDensityLow(value: number) {
    this.gridDensityLowUniform.value = value;
  }

  get gridDensityLow(): number {
    return this.gridDensityLowUniform.value as number;
  }

  set gridDensityHigh(value: number) {
    this.gridDensityHighUniform.value = value;
  }

  get gridDensityHigh(): number {
    return this.gridDensityHighUniform.value as number;
  }

  set jitterStrengthLow(value: number) {
    this.jitterStrengthLowUniform.value = value;
  }

  get jitterStrengthLow(): number {
    return this.jitterStrengthLowUniform.value as number;
  }

  set jitterStrengthHigh(value: number) {
    this.jitterStrengthHighUniform.value = value;
  }

  get jitterStrengthHigh(): number {
    return this.jitterStrengthHighUniform.value as number;
  }
}
