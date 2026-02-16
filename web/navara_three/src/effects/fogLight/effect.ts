import { Camera, PerspectiveCamera, OrthographicCamera, Vector3 } from "three";

import { Color } from "../../Color";
import {
  Pass as PassWrapper,
  type EffectEvents,
  type EffectOptions,
} from "../effect";

import { FogLightDownsampledPass } from "./FogLightDownsampledPass";
import {
  DEFAULT_FOG_LIGHT_EFFECT_OPTIONS,
  FogLightEffect,
  type FogLightDefinition,
  type FogLightEffectOptions,
} from "./FogLightEffect";

export type FogLightEvents = EffectEvents;

export type FogLightOptions = FogLightEffectOptions &
  EffectOptions & {
    // Downsample factor: 1 = full-res, 2 = half, 4 = quarter. Default 1.
    downsample?: number;
  };

export const DEFAULT_FOG_LIGHT_OPTIONS: FogLightOptions = {
  ...DEFAULT_FOG_LIGHT_EFFECT_OPTIONS,
  enabled: true,
  downsample: 2,
};

export class FogLight extends PassWrapper<
  FogLightDownsampledPass,
  FogLightEffect,
  FogLightOptions,
  FogLightEvents
> {
  constructor(camera: Camera, options?: FogLightOptions) {
    const mergedOptions = { ...DEFAULT_FOG_LIGHT_OPTIONS, ...options };
    const perspectiveOrOrthoCamera = camera as
      | PerspectiveCamera
      | OrthographicCamera;

    const { downsample, ...effectOptions } = mergedOptions;
    const effect = new FogLightEffect(
      perspectiveOrOrthoCamera,
      effectOptions as FogLightEffectOptions,
    );

    const ds = downsample || 1;
    const downPass = new FogLightDownsampledPass(
      perspectiveOrOrthoCamera,
      effect,
      { downsample: ds },
    );
    super(downPass, effect, mergedOptions);
  }

  protected onMounted(): void {
    this.updateLights();
    this.updateFogDensity();
    this.updateUseSurfaceLighting();
  }

  private updateLights(): void {
    if (!this.rawEffect) return;

    const lights = this.options.lights ?? [];
    const maxLights =
      this.options.maxLights ?? DEFAULT_FOG_LIGHT_OPTIONS.maxLights ?? 0;
    const numLights = Math.min(lights.length, maxLights);

    // Warn if there are more lights than maxLights
    if (lights.length > maxLights) {
      console.warn(
        `FogLight: ${lights.length} lights specified, but only ${maxLights} will be rendered. ` +
          `Consider increasing the 'maxLights' option if you need more lights.`,
      );
    }

    // Write light data to buffers
    for (let i = 0; i < numLights; i++) {
      const light = lights[i];
      const position = new Vector3(
        light.position.x,
        light.position.y,
        light.position.z,
      );
      const color =
        light.color instanceof Color
          ? light.color
          : new Color().setHex(light.color);

      this.rawEffect.writeLight(
        i,
        color,
        light.intensity,
        position,
        light.radius ?? 500,
      );
    }

    // Clear remaining slots
    for (let i = numLights; i < maxLights; i++) {
      this.rawEffect.writeLight(
        i,
        new Color().setRGB(0, 0, 0),
        0,
        new Vector3(0, 0, 0),
      );
    }

    // Update textures
    this.rawEffect.updateLightTextures();

    this.rawEffect.defines.set("NUM_FOG_LIGHT", numLights.toString());
  }

  private updateFogDensity(): void {
    if (!this.rawEffect) return;
    const fogDensityUniform = this.rawEffect.uniforms.get("fogDensity");
    if (fogDensityUniform) {
      fogDensityUniform.value =
        this.options.fogDensity ?? DEFAULT_FOG_LIGHT_OPTIONS.fogDensity;
    }
  }

  get lights(): FogLightDefinition[] {
    return this.options.lights ?? [];
  }

  set lights(lights: FogLightDefinition[]) {
    this.options.lights = lights;
    this.updateLights();
    this.emit("_needsUpdate");
  }

  get fogDensity(): number {
    return (
      this.options.fogDensity ?? DEFAULT_FOG_LIGHT_OPTIONS.fogDensity ?? 0.1
    );
  }

  set fogDensity(value: number) {
    this.options.fogDensity = value;
    this.updateFogDensity();
    this.emit("_needsUpdate");
  }

  get useSurfaceLighting(): boolean {
    return (
      this.options.useSurfaceLighting ??
      DEFAULT_FOG_LIGHT_OPTIONS.useSurfaceLighting ??
      false
    );
  }

  set useSurfaceLighting(value: boolean) {
    this.options.useSurfaceLighting = value;
    this.updateUseSurfaceLighting();
    this.emit("_needsUpdate");
  }

  private updateUseSurfaceLighting(): void {
    if (!this.rawEffect) return;
    const useSurfaceLightingUniform =
      this.rawEffect.uniforms.get("useSurfaceLighting");
    if (useSurfaceLightingUniform) {
      useSurfaceLightingUniform.value =
        this.options.useSurfaceLighting ??
        DEFAULT_FOG_LIGHT_OPTIONS.useSurfaceLighting;
    }
  }

  get downsample(): number {
    return this.raw.downsample;
  }

  set downsample(value: number) {
    this.raw.downsample = value;
  }

  get maxLightsPerTile(): number {
    return this.rawEffect.maxLightsPerTile;
  }

  set maxLightsPerTile(value: number) {
    this.rawEffect.maxLightsPerTile = value;
    this.emit("_needsUpdate");
  }

  get extentScale(): number {
    return this.rawEffect.extentScale;
  }

  set extentScale(value: number) {
    this.rawEffect.extentScale = value;
    this.emit("_needsUpdate");
  }

  get maxFar(): number {
    return this.rawEffect.maxFar;
  }

  set maxFar(value: number) {
    this.rawEffect.maxFar = value;
    this.emit("_needsUpdate");
  }

  get debugShowGrid(): boolean {
    return this.rawEffect.debugShowGrid;
  }
  set debugShowGrid(v: boolean) {
    this.rawEffect.debugShowGrid = v;
    this.emit("_needsUpdate");
  }
}
