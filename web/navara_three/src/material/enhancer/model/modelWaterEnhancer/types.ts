import type { Texture } from "three";

import type { UniformValue } from "../../../types";
import type { Mutates } from "../../MaterialEnhancer";
import type {
  ModelBaseMutates,
  ModelBaseProps,
  ModelBaseState,
} from "../modelBaseEnhancer";

/**
 * Water-only props (excluding base props).
 */
export type ModelWaterOnlyProps = {
  water?: boolean;
  waterScaleNormal?: number;
  waterSpeed?: number;
  shininess?: number;
  specularStrength?: number;
  applyWaterNormal?: number | boolean;
  specular?: boolean;
  ior?: number;
  reflectivity?: number;

  // Sky environment map texture value
  skyEnvMap?: Texture | null;

  // Water normal map texture (value-based, not ref-based)
  // This ref identity doesn't change, so we assign the ref object itself
  waterNormalMap?: UniformValue<Texture | null>;

  // External uniform ref (ref-based, shared with CommonUniforms)
  // This ref identity doesn't change, so we assign the ref object itself
  timeUniform?: UniformValue<number>;

  // External uniform ref for sky env map cubemap
  skyEnvMapUniform?: UniformValue<Texture | null>;
};

/**
 * Combined props for the model water enhancer.
 * Props are explicitly separated into base and water sections for clarity.
 */
export type ModelWaterProps = {
  base?: ModelBaseProps;
  water?: ModelWaterOnlyProps;
};

/**
 * Immutable state for the water enhancer.
 * This state is always replaced as a whole (never mutated).
 * Returned directly via states() - refresh after updates.
 */
export type ModelWaterState = Readonly<{
  useWater: boolean;
  skyEnvMap: Texture | null;
  reflectivity: number;
  waterScaleNormal: number;
  waterSpeed: number;
  shininess: number;
  specularStrength: number;
  applyWaterNormal: boolean;
  specular: boolean;
  ior: number;
}>;

/**
 * Combined state for the model water enhancer.
 * Includes both base state and water-specific state.
 */
export type ModelWaterCombinedStates = {
  readonly base: ModelBaseState;
  readonly water: ModelWaterState;
};

/**
 * Combined mutation functions for the model water enhancer.
 */
export type ModelWaterCombinedMutates = {
  readonly base: ModelBaseMutates;
  readonly water: ModelWaterMutates;
};

/**
 * Mutable references (uniforms) for the water enhancer.
 *
 * These are shared references with shader.uniforms and can be mutated directly
 * for efficient GPU uniform updates without shader recompilation.
 * Internal type - not exposed externally.
 */
export type ModelWaterRefs = {
  // Internal refs (value-based updates)
  reflectivity: UniformValue<number>;
  uWaterNormalMap: UniformValue<Texture | null>;
  cachedWaterNormalMap: UniformValue<Texture | null>;
  uWaterScaleNormal: UniformValue<number>;
  uWaterSpeed: UniformValue<number>;
  uShininess: UniformValue<number>;
  uSpecularStrength: UniformValue<number>;
  uApplyWaterNormal: UniformValue<number>;
  uSpecular: UniformValue<boolean>;
  uIor: UniformValue<number>;

  // External uniform refs (assigned as ref object, identity doesn't change)
  uTime?: UniformValue<number>;
  tSkyEnvMap?: UniformValue<Texture | null>;
};

export type ModelWaterUniforms = Partial<
  Omit<ModelWaterRefs, "cachedWaterNormalMap">
>;

/**
 * Mutation functions for the water enhancer (internal only).
 */
export type ModelWaterMutates = Mutates<
  ModelWaterState,
  ModelWaterUniforms,
  {
    /**
     * Set the water normal map uniform ref.
     * Assigns the external ref object (identity doesn't change after mount).
     */
    setWaterNormalMap: (
      waterNormalMapUniform: UniformValue<Texture | null>,
      useWater: boolean,
    ) => void;
    /**
     * Set the time uniform ref.
     * Assigns the external ref object (identity doesn't change after mount).
     */
    setTimeUniform: (timeUniform: UniformValue<number>) => void;
    /**
     * Set the sky env map uniform ref.
     * Assigns the external ref object (identity doesn't change after mount).
     */
    setSkyEnvMapUniform: (
      skyEnvMapUniform: UniformValue<Texture | null>,
    ) => void;
  }
>;
