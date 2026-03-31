import type { Matrix4, Texture, Vector3 } from "three";
import {
  Color as ThreeColor,
  Matrix4 as ThreeMatrix4,
  Vector3 as ThreeVector3,
} from "three";

import type { UniformValue } from "../../../types";

import type {
  PolygonBaseMutates,
  PolygonBaseRefs,
  PolygonBaseState,
} from "./types";

/**
 * Default refs with initial values.
 * These are cloned in createBaseMutates and synced from state via update().
 */
const DEFAULT_BASE_REFS: Omit<
  PolygonBaseRefs,
  "uEmissiveColor" | "uEmissiveIntensity"
> = {
  uMinMaxHeight: { value: undefined },
  uAddExtrudedHeight: { value: 0 },
  uAddHeight: { value: 0 },
  uClampToGround: { value: false },
  nvr_uPickable: { value: 0 },
  uEmissiveOnly: { value: 0 },
  uIsTexturized: { value: false },
  reflectivity: { value: 0 },
  roughness: { value: 0 },
};

/**
 * Create mutation functions for the polygon base enhancer.
 * Refs are created internally and captured via closure.
 *
 * @param useRTE - Whether RTE is enabled (determines if RTE refs are created)
 */
export const createBaseMutates = (useRTE: boolean): PolygonBaseMutates => {
  // Clone defaults so each enhancer instance gets independent ref objects
  const refs = structuredClone(DEFAULT_BASE_REFS) as PolygonBaseRefs;

  // Emissive refs (Color can't be structuredClone'd)
  refs.uEmissiveColor = { value: new ThreeColor(0, 0, 0) };
  refs.uEmissiveIntensity = { value: 0 };

  // Conditionally create RTE refs (useRTE can't change after mount)
  if (useRTE) {
    refs.modelViewMatrixRTE = { value: new ThreeMatrix4() };
    refs.u_cameraPositionHigh = { value: new ThreeVector3() };
    refs.u_cameraPositionLow = { value: new ThreeVector3() };
  }

  return {
    update: (state) => {
      // Sync refs from state
      refs.uMinMaxHeight.value = state.minMaxHeight;
      refs.uAddExtrudedHeight.value = state.addExtrudedHeight;
      refs.uAddHeight.value = state.addHeight;
      refs.uClampToGround.value = state.clampToGround;
      refs.nvr_uPickable.value = state.pickable ? 1 : 0;
      refs.uEmissiveOnly.value = state.emissiveOnly ? 1 : 0;
      refs.uEmissiveColor.value.set(state.emissiveColor);
      refs.uEmissiveIntensity.value = state.emissiveIntensity;
      refs.uIsTexturized.value = state.isTexturized;
      refs.reflectivity.value = state.reflectivity;
      refs.roughness.value = state.roughness;
    },
    updateUniforms: (uniforms, state) => {
      // Assign core uniform refs to shader.uniforms
      if (refs.uGlobeNormal) {
        uniforms.uGlobeNormal = refs.uGlobeNormal;
      }
      uniforms.nvr_uPickable = refs.nvr_uPickable;
      uniforms.uEmissiveOnly = refs.uEmissiveOnly;
      uniforms.uEmissiveColor = refs.uEmissiveColor;
      uniforms.uEmissiveIntensity = refs.uEmissiveIntensity;
      uniforms.reflectivity = refs.reflectivity;
      uniforms.roughness = refs.roughness;

      // RTE uniforms
      if (
        state.useRTE &&
        refs.modelViewMatrixRTE &&
        refs.u_cameraPositionHigh &&
        refs.u_cameraPositionLow
      ) {
        uniforms.u_cameraPositionHigh = refs.u_cameraPositionHigh;
        uniforms.u_cameraPositionLow = refs.u_cameraPositionLow;
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
      refs.uGlobeNormal = texture;
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
      if (refs.u_cameraPositionHigh) {
        refs.u_cameraPositionHigh.value.copy(cameraPositionHigh);
      }
      if (refs.u_cameraPositionLow) {
        refs.u_cameraPositionLow.value.copy(cameraPositionLow);
      }
    },
  };
};
