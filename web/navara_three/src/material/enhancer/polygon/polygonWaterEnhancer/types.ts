import type { Texture } from "three";

import type { UniformValue } from "../../../types";
import type { Mutates } from "../../MaterialEnhancer";
import type {
  PolygonBaseMutates,
  PolygonBaseProps,
  PolygonBaseState,
} from "../polygonBaseEnhancer";

/**
 * Water-only props (excluding base props).
 */
export type WaterOnlyProps = {
  water?: boolean;
  waterScaleNormal?: number;
  waterSpeed?: number;
  shininess?: number;
  specularStrength?: number;
  applyWaterNormal?: boolean;
  specular?: boolean;
  ior?: number;
  skyEnvMap?: Texture | null;

  // Water normal map texture (value-based, not ref-based)
  // This is set dynamically and may change identity, so we mutate the internal ref's value
  waterNormalMap?: Texture | null;

  // External uniform ref (ref-based, shared with CommonUniforms)
  // This ref identity doesn't change, so we assign the ref object itself
  timeUniform?: UniformValue<number>;
};

/**
 * Combined props for the polygon water enhancer.
 * Props are explicitly separated into base and water sections for clarity.
 */
export type PolygonWaterProps = {
  base?: PolygonBaseProps;
  water?: WaterOnlyProps;
};

/**
 * Immutable state for the water enhancer.
 * This state is always replaced as a whole (never mutated).
 * Returned directly via states() - refresh after updates.
 */
export type PolygonWaterState = Readonly<{
  useWater: boolean;
  skyEnvMap: Texture | null;
  waterNormalMap: Texture | null;
  waterScaleNormal: number;
  waterSpeed: number;
  shininess: number;
  specularStrength: number;
  applyWaterNormal: boolean;
  specular: boolean;
  ior: number;
}>;

/**
 * Combined state for the polygon water enhancer.
 * Includes both base state and water-specific state.
 */
export type PolygonWaterCombinedStates = {
  readonly base: PolygonBaseState;
  readonly water: PolygonWaterState;
};

/**
 * Combined mutation functions for the polygon water enhancer.
 */
export type PolygonWaterCombinedMutates = {
  readonly base: PolygonBaseMutates;
  readonly water: WaterMutates;
};

/**
 * Mutable references (uniforms) for the water enhancer.
 *
 * These are shared references with shader.uniforms and can be mutated directly
 * for efficient GPU uniform updates without shader recompilation.
 * Internal type - not exposed externally.
 */
export type PolygonWaterRefs = {
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
  uTime?: UniformValue<number>;
};

export type PolygonWaterUniforms = Partial<PolygonWaterRefs>;

/**
 * Mutation functions for the water enhancer (internal only).
 */
export type WaterMutates = Mutates<
  PolygonWaterState,
  PolygonWaterUniforms,
  {
    /**
     * Set the time uniform ref.
     * Assigns the external ref object (identity doesn't change after mount).
     */
    setTimeUniform: (timeUniform: UniformValue<number>) => void;
  }
>;
