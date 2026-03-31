import { encodePosition } from "@navara/engine-api";
import {
  Color as ThreeColor,
  DataArrayTexture,
  Vector2 as ThreeVector2,
  Vector3 as ThreeVector3,
} from "three";

import type { UniformValue } from "../../../types";

import type {
  InstancedSpriteBaseMutates,
  InstancedSpriteBaseRefs,
  InstancedSpriteBaseState,
} from "./types";

/**
 * Create mutation functions for the instancedSprite base enhancer.
 * Refs are created internally and captured via closure.
 *
 * @param _useRTE - Whether RTE is enabled (reserved for API consistency)
 * @param billboard - Whether billboard mode is enabled (determines if texture ref is created)
 * @param rtcCenter - The RTC center position [x, y, z]
 */
export const createBaseMutates = (
  _useRTE: boolean,
  billboard: boolean,
  rtcCenter?: [number, number, number],
): InstancedSpriteBaseMutates => {
  const refs: InstancedSpriteBaseRefs = {
    uRTCCenter: {
      value: new ThreeVector3(
        rtcCenter?.[0] ?? 0,
        rtcCenter?.[1] ?? 0,
        rtcCenter?.[2] ?? 0,
      ),
    },
    uEyeRTELow: { value: new ThreeVector3(0, 0, 0) },
    uEyeRTEHigh: { value: new ThreeVector3(0, 0, 0) },
    uScale: { value: 100.0 },
    uCenter: { value: new ThreeVector2(0, 0) },
    uScaleByDistance: { value: true },
    uOffsetDepth: { value: true },
    uAlphaTest: { value: 0.0 },
    uFarPlane: { value: 0.0 },
    uAspect: { value: 1.0 },
    nvr_uPickable: { value: 0.0 },
    uEmissiveOnly: { value: 0 },
    uEmissiveColor: { value: new ThreeColor(0, 0, 0) },
    uEmissiveIntensity: { value: 0 },
  };

  // Conditionally create texture ref for billboard mode
  if (billboard) {
    refs.uTexture = { value: null };
  }

  return {
    update: (state: InstancedSpriteBaseState) => {
      refs.uScale.value = state.scale;
      refs.uCenter.value.set(state.center[0], state.center[1]);
      refs.uScaleByDistance.value = state.scaleByDistance;
      refs.uOffsetDepth.value = state.offsetDepth;
      refs.uAlphaTest.value = state.alphaTest;
      refs.uAspect.value = state.aspect;
      refs.nvr_uPickable.value = state.pickable ? 1.0 : 0.0;
      refs.uEmissiveOnly.value = state.emissiveOnly ? 1 : 0;
      refs.uEmissiveColor.value.set(state.emissiveColor);
      refs.uEmissiveIntensity.value = state.emissiveIntensity;
    },

    updateUniforms: (uniforms) => {
      uniforms.uRTCCenter = refs.uRTCCenter;
      uniforms.uEyeRTELow = refs.uEyeRTELow;
      uniforms.uEyeRTEHigh = refs.uEyeRTEHigh;
      uniforms.uScale = refs.uScale;
      uniforms.uCenter = refs.uCenter;
      uniforms.uScaleByDistance = refs.uScaleByDistance;
      uniforms.uOffsetDepth = refs.uOffsetDepth;
      uniforms.uAlphaTest = refs.uAlphaTest;
      uniforms.uFarPlane = refs.uFarPlane;
      uniforms.uAspect = refs.uAspect;
      uniforms.nvr_uPickable = refs.nvr_uPickable;
      uniforms.uEmissiveOnly = refs.uEmissiveOnly;
      uniforms.uEmissiveColor = refs.uEmissiveColor;
      uniforms.uEmissiveIntensity = refs.uEmissiveIntensity;

      if (refs.uTexture) {
        uniforms.uTexture = refs.uTexture;
      }
    },

    updateRteUniforms: (
      cameraX: number,
      cameraY: number,
      cameraZ: number,
      state: InstancedSpriteBaseState,
    ) => {
      if (!state.useRTE) return;
      const encoded = encodePosition(cameraX, cameraY, cameraZ);
      refs.uEyeRTELow.value.set(encoded.low.x, encoded.low.y, encoded.low.z);
      refs.uEyeRTEHigh.value.set(
        encoded.high.x,
        encoded.high.y,
        encoded.high.z,
      );
    },

    updateFarPlane: (far: number) => {
      refs.uFarPlane.value = far;
    },

    setTexture: (texture: UniformValue<DataArrayTexture | null>) => {
      if (refs.uTexture) {
        refs.uTexture.value = texture.value;
      }
    },
  };
};
