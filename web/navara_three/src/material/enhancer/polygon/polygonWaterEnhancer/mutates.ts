import type { Texture } from "three";

import type { UniformValue } from "../../../types";

import type { WaterMutates } from "./types";

/**
 * Mutable references (uniforms) for the water enhancer.
 *
 * These are shared references with shader.uniforms and can be mutated directly
 * for efficient GPU uniform updates without shader recompilation.
 * Internal type - not exposed externally.
 */
type PolygonWaterRefs = {
  // Internal refs (value-based updates)
  uWaterNormalMap: UniformValue<Texture | null>;
  uWaterScaleNormal: UniformValue<number>;
  uWaterSpeed: UniformValue<number>;
  uShininess: UniformValue<number>;
  uSpecularStrength: UniformValue<number>;
  uApplyWaterNormal: UniformValue<number>;
  uSpecular: UniformValue<boolean>;
  uIor: UniformValue<number>;

  // External uniform ref (assigned as ref object, identity doesn't change)
  timeUniform?: UniformValue<number>;
};

/**
 * Default refs with initial values.
 * These are cloned in createWaterMutates and synced from state via update().
 * Note: timeUniform is an external ref assigned via setter (identity doesn't change).
 */
const DEFAULT_WATER_REFS: Omit<PolygonWaterRefs, "timeUniform"> = {
  uWaterNormalMap: { value: null },
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
export const createWaterMutates = (): WaterMutates => {
  // Clone defaults so each enhancer instance gets independent ref objects
  // timeUniform is an external ref assigned via setter (identity doesn't change)
  const refs: PolygonWaterRefs = structuredClone(DEFAULT_WATER_REFS);

  return {
    update: (state) => {
      // Sync refs from state
      refs.uWaterNormalMap.value = state.waterNormalMap;
      refs.uWaterScaleNormal.value = state.waterScaleNormal;
      refs.uWaterSpeed.value = state.waterSpeed;
      refs.uShininess.value = state.shininess;
      refs.uSpecularStrength.value = state.specularStrength;
      refs.uApplyWaterNormal.value = state.applyWaterNormal;
      refs.uSpecular.value = state.specular;
      refs.uIor.value = state.ior;
    },
    updateUniforms: (uniforms) => {
      // Assign water uniform refs to shader.uniforms
      uniforms.uWaterNormalMap = refs.uWaterNormalMap;
      uniforms.uWaterScaleNormal = refs.uWaterScaleNormal;
      uniforms.uWaterSpeed = refs.uWaterSpeed;
      uniforms.uShininess = refs.uShininess;
      uniforms.uSpecularStrength = refs.uSpecularStrength;
      uniforms.uApplyWaterNormal = refs.uApplyWaterNormal;
      uniforms.uSpecular = refs.uSpecular;
      uniforms.uIor = refs.uIor;
      if (refs.timeUniform) {
        uniforms.uTime = refs.timeUniform;
      }
    },
    setTimeUniform: (timeUniform: UniformValue<number>): void => {
      // Assign external ref object (identity doesn't change after mount)
      refs.timeUniform = timeUniform;
    },
  };
};
