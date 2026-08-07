import {
  Color,
  Pass as PassWrapper,
  type EffectEvents,
  type EffectOptions,
} from "@navaramap/three";
import {
  Camera,
  PerspectiveCamera,
  OrthographicCamera,
  Vector3,
  type Texture,
} from "three";

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
    /**
     * Fog render scale divisor: 1 = full-res, 2 = half, 4 = quarter
     * (default: 4). The low-res fog is composited back with depth-aware
     * upsampling, so higher divisors stay clean along silhouettes.
     */
    downsample?: number;
  };

export const DEFAULT_FOG_LIGHT_OPTIONS: FogLightOptions = {
  ...DEFAULT_FOG_LIGHT_EFFECT_OPTIONS,
  enabled: true,
  downsample: 4,
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
      PerspectiveCamera | OrthographicCamera;

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

  setNormalBuffer(texture: Texture | null): void {
    if (!this.rawEffect) return;
    const uniform = this.rawEffect.uniforms.get("normalBuffer");
    if (uniform) uniform.value = texture;
  }

  protected onMounted(): void {
    this.updateLights();
    this.updateFogDensity();
    this.updateUseSurfaceLighting();
  }

  private updateLights(): void {
    if (!this.rawEffect) return;

    const lights = this.options.lights ?? [];
    const numLights = lights.length;
    this.rawEffect.ensureLightCapacity(numLights);

    // Write light data to buffers
    const position = new Vector3();
    const scratchColor = new Color();
    for (let i = 0; i < numLights; i++) {
      const light = lights[i];
      position.set(light.position.x, light.position.y, light.position.z);
      const color =
        light.color instanceof Color
          ? light.color
          : scratchColor.setHex(light.color);

      this.rawEffect.writeLight(
        i,
        color,
        light.intensity,
        position,
        light.radius ?? 500,
      );
    }

    // Clear remaining slots
    position.set(0, 0, 0);
    scratchColor.setRGB(0, 0, 0);
    for (let i = numLights; i < this.rawEffect.lightCapacity; i++) {
      this.rawEffect.writeLight(i, scratchColor, 0, position);
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
    this.emit("needsUpdate");
  }

  get fogDensity(): number {
    return (
      this.options.fogDensity ?? DEFAULT_FOG_LIGHT_OPTIONS.fogDensity ?? 0.1
    );
  }

  set fogDensity(value: number) {
    this.options.fogDensity = value;
    this.updateFogDensity();
    this.emit("needsUpdate");
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
    this.emit("needsUpdate");
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
    this.emit("needsUpdate");
  }

  get extentScale(): number {
    return this.rawEffect.extentScale;
  }

  set extentScale(value: number) {
    this.rawEffect.extentScale = value;
    this.emit("needsUpdate");
  }

  get maxFar(): number {
    return this.rawEffect.maxFar;
  }

  set maxFar(value: number) {
    this.rawEffect.maxFar = value;
    this.emit("needsUpdate");
  }

  get haloFalloff(): number {
    return this.rawEffect.haloFalloff;
  }

  set haloFalloff(value: number) {
    this.rawEffect.haloFalloff = value;
    this.emit("needsUpdate");
  }

  get debugShowGrid(): boolean {
    return this.rawEffect.debugShowGrid;
  }
  set debugShowGrid(v: boolean) {
    this.rawEffect.debugShowGrid = v;
    this.emit("needsUpdate");
  }
}
