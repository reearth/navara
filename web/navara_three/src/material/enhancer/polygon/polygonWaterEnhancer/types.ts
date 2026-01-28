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
  applyWaterNormal?: number;
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
  applyWaterNormal: number;
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
 * Includes base mutation functions (water enhancer has no additional mutations).
 */
export type PolygonWaterCombinedMutates = {
  readonly base: PolygonBaseMutates;
};

/**
 * Mutation functions for the water enhancer (internal only).
 */
export type WaterMutates = Mutates<
  PolygonWaterState,
  {
    /**
     * Set the time uniform ref.
     * Assigns the external ref object (identity doesn't change after mount).
     */
    setTimeUniform: (timeUniform: UniformValue<number>) => void;
  }
>;
