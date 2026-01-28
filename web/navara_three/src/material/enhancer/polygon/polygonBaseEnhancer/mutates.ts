import type { Matrix4, Texture, Vector3 } from "three";
import { Matrix4 as ThreeMatrix4, Vector3 as ThreeVector3 } from "three";

import type { UniformValue } from "../../../types";

import type { PolygonBaseMutates, PolygonBaseState } from "./types";

/**
 * Mutable references (uniforms) for the polygon base enhancer.
 *
 * These are shared references with shader.uniforms and can be mutated directly
 * for efficient GPU uniform updates without shader recompilation.
 * Internal type - not exposed externally.
 */
type PolygonBaseRefs = {
  // Core uniforms
  uMinMaxHeight: UniformValue<[number, number] | undefined>;
  uAddExtrudedHeight: UniformValue<number>;
  uAddHeight: UniformValue<number>;
  uClampToGround: UniformValue<boolean>;
  useGroundNormals: UniformValue<boolean>;
  nvr_uPickable: UniformValue<number>;
  uIsTexturized: UniformValue<boolean>;
  reflectivity: UniformValue<number>;
  roughness: UniformValue<number>;

  // Optional uniforms
  batchDataTexture?: UniformValue<Texture | null>;
  globeNormalTexture?: UniformValue<Texture | null>;

  // RTE uniforms (only present if useRTE is true)
  modelViewMatrixRTE?: UniformValue<Matrix4>;
  cameraPositionHigh?: UniformValue<Vector3>;
  cameraPositionLow?: UniformValue<Vector3>;
};

/**
 * Default refs with initial values.
 * These are cloned in createBaseMutates and synced from state via update().
 */
const DEFAULT_BASE_REFS: PolygonBaseRefs = {
  uMinMaxHeight: { value: undefined },
  uAddExtrudedHeight: { value: 0 },
  uAddHeight: { value: 0 },
  uClampToGround: { value: false },
  useGroundNormals: { value: false },
  nvr_uPickable: { value: 0 },
  uIsTexturized: { value: false },
  reflectivity: { value: 0 },
  roughness: { value: 0 },
};

/**
 * Create mutation functions for the polygon base enhancer.
 * Refs are created internally and captured via closure.
 *
 * @param useRTE - Whether RTE is enabled (determines if RTE refs are created)
 * @param getState - Callback to read current state; used in updateUniforms()
 *   to conditionally assign refs based on runtime state (e.g., useRTE flag)
 */
export const createBaseMutates = (useRTE: boolean): PolygonBaseMutates => {
  // Clone defaults so each enhancer instance gets independent ref objects
  const refs = structuredClone(DEFAULT_BASE_REFS) as PolygonBaseRefs;

  // Conditionally create RTE refs (useRTE can't change after mount)
  if (useRTE) {
    refs.modelViewMatrixRTE = { value: new ThreeMatrix4() };
    refs.cameraPositionHigh = { value: new ThreeVector3() };
    refs.cameraPositionLow = { value: new ThreeVector3() };
  }

  return {
    update: (state) => {
      // Sync refs from state
      refs.uMinMaxHeight.value = state.minMaxHeight;
      refs.uAddExtrudedHeight.value = state.addExtrudedHeight;
      refs.uAddHeight.value = state.addHeight;
      refs.uClampToGround.value = state.clampToGround;
      refs.useGroundNormals.value = state.useGroundNormals;
      refs.nvr_uPickable.value = state.pickable ? 1 : 0;
      refs.uIsTexturized.value = state.isTexturized;
      refs.reflectivity.value = state.reflectivity;
      refs.roughness.value = state.roughness;
    },
    updateUniforms: (uniforms, state) => {
      // Assign core uniform refs to shader.uniforms
      if (refs.globeNormalTexture) {
        uniforms.uGlobeNormal = refs.globeNormalTexture;
      }
      uniforms.nvr_uPickable = refs.nvr_uPickable;
      uniforms.useGroundNormals = refs.useGroundNormals;
      uniforms.reflectivity = refs.reflectivity;
      uniforms.roughness = refs.roughness;

      // RTE uniforms
      if (
        state.useRTE &&
        refs.modelViewMatrixRTE &&
        refs.cameraPositionHigh &&
        refs.cameraPositionLow
      ) {
        uniforms.u_cameraPositionHigh = refs.cameraPositionHigh;
        uniforms.u_cameraPositionLow = refs.cameraPositionLow;
        uniforms.modelViewMatrixRTE = refs.modelViewMatrixRTE;
      }

      // Height uniforms
      if (refs.uMinMaxHeight.value) {
        uniforms.uMinMaxHeight = refs.uMinMaxHeight;
      }
      uniforms.uAddExtrudedHeight = refs.uAddExtrudedHeight;
      uniforms.uAddHeight = refs.uAddHeight;
      uniforms.uClampToGround = refs.uClampToGround;

      // Batch texture
      if (refs.batchDataTexture) {
        uniforms.batchDataTexture = refs.batchDataTexture;
      }

      uniforms.uIsTexturized = refs.uIsTexturized;
    },
    setBatchDataTexture: (texture: UniformValue<Texture | null>): void => {
      refs.batchDataTexture = texture;
    },
    setGlobeNormalTexture: (texture: UniformValue<Texture | null>): void => {
      refs.globeNormalTexture = texture;
    },
    updateRteUniforms: (
      modelViewMatrixRTE: Matrix4,
      cameraPositionHigh: Vector3,
      cameraPositionLow: Vector3,
      state: PolygonBaseState,
    ): void => {
      if (!state.useRTE) return;
      if (refs.modelViewMatrixRTE) {
        refs.modelViewMatrixRTE.value.copy(modelViewMatrixRTE);
      }
      if (refs.cameraPositionHigh) {
        refs.cameraPositionHigh.value.copy(cameraPositionHigh);
      }
      if (refs.cameraPositionLow) {
        refs.cameraPositionLow.value.copy(cameraPositionLow);
      }
    },
  };
};
