import type { Texture } from "three";

import type { UniformValue } from "../../../types";

import type { ModelWaterMutates, ModelWaterRefs } from "./types";

/**
 * Default refs with initial values.
 * These are cloned in createWaterMutates and synced from state via update().
 * Note: timeUniform and tSkyEnvMap are external refs assigned via setters (identity doesn't change).
 */
const DEFAULT_WATER_REFS: Omit<ModelWaterRefs, "uTime" | "tSkyEnvMap"> = {
  reflectivity: { value: 0 },
  uWaterNormalMap: { value: null },
  cachedWaterNormalMap: { value: null },
  uWaterScaleNormal: { value: 0 },
  uWaterSpeed: { value: 0 },
  uShininess: { value: 0 },
  uSpecularStrength: { value: 0 },
  uApplyWaterNormal: { value: 0 },
  uSpecular: { value: false },
  uIor: { value: 1.33333 },
};

/**
 * Create mutation functions for the water enhancer.
 * Refs are created internally and captured via closure.
 */
export const createWaterMutates = (): ModelWaterMutates => {
  // Clone defaults so each enhancer instance gets independent ref objects
  // timeUniform and tSkyEnvMap are external refs assigned via setters (identity doesn't change)
  const refs: ModelWaterRefs = structuredClone(DEFAULT_WATER_REFS);

  return {
    update: (state) => {
      // Sync refs from state
      refs.reflectivity.value = state.reflectivity;
      refs.uWaterNormalMap.value = state.useWater
        ? refs.cachedWaterNormalMap.value
        : null;
      refs.uWaterScaleNormal.value = state.waterScaleNormal;
      refs.uWaterSpeed.value = state.waterSpeed;
      refs.uShininess.value = state.shininess;
      refs.uSpecularStrength.value = state.specularStrength;
      // Cast boolean to number for shader uniform
      refs.uApplyWaterNormal.value = state.applyWaterNormal ? 1 : 0;
      refs.uSpecular.value = state.specular;
      refs.uIor.value = state.ior;
    },
    updateUniforms: (uniforms) => {
      // Assign water uniform refs to shader.uniforms
      uniforms.reflectivity = refs.reflectivity;
      uniforms.uWaterNormalMap = refs.uWaterNormalMap;
      uniforms.uWaterScaleNormal = refs.uWaterScaleNormal;
      uniforms.uWaterSpeed = refs.uWaterSpeed;
      uniforms.uShininess = refs.uShininess;
      uniforms.uSpecularStrength = refs.uSpecularStrength;
      uniforms.uApplyWaterNormal = refs.uApplyWaterNormal;
      uniforms.uSpecular = refs.uSpecular;
      uniforms.uIor = refs.uIor;
      if (refs.uTime) {
        uniforms.uTime = refs.uTime;
      }
      if (refs.tSkyEnvMap) {
        uniforms.tSkyEnvMap = refs.tSkyEnvMap;
      }
    },
    setWaterNormalMap: (
      waterNormalMapUniform: UniformValue<Texture | null>,
      useWater: boolean,
    ): void => {
      // Assign external ref object (identity doesn't change after mount)
      refs.cachedWaterNormalMap = waterNormalMapUniform;
      refs.uWaterNormalMap.value = useWater
        ? refs.cachedWaterNormalMap.value
        : null;
    },
    setTimeUniform: (timeUniform: UniformValue<number>): void => {
      // Assign external ref object (identity doesn't change after mount)
      refs.uTime = timeUniform;
    },
    setSkyEnvMapUniform: (
      skyEnvMapUniform: UniformValue<Texture | null>,
    ): void => {
      // Assign external ref object (identity doesn't change after mount)
      refs.tSkyEnvMap = skyEnvMapUniform;
    },
  };
};
