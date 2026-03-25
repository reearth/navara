import { encodePosition } from "@navara/engine-api";
import { Color, DataTexture, Vector2, Vector3 } from "three";

import type { UniformValue } from "../../../types";

import type {
  SdfTextBaseMutates,
  SdfTextBaseRefs,
  SdfTextBaseState,
} from "./types";

/**
 * Create mutation functions for the sdfText base enhancer.
 * Refs are created internally and captured via closure.
 *
 * @param useRTE - Whether RTE positioning is enabled
 * @param rtcCenter - The RTC center position [x, y, z]
 * @param batchId - Batch ID for picking
 */
export const createBaseMutates = (
  useRTE: boolean,
  rtcCenter?: [number, number, number],
  batchId?: number,
): SdfTextBaseMutates => {
  const refs: SdfTextBaseRefs = {
    uColor: { value: new Color(1, 1, 1) },
    uFontSize: { value: 16.0 },
    uCenter: { value: new Vector2(0.5, 0.0) },
    uSizeInMeters: { value: false },
    uAddHeight: { value: 0.0 },
    uOffsetDepth: { value: true },
    uSdfThreshold: { value: 0.5 },
    uOutlineWidth: { value: 0.0 },
    uOutlineColor: { value: new Color(1, 0, 0) },
    uOutlineOpacity: { value: 1.0 },
    uShowBackground: { value: false },
    uBackgroundColor: { value: new Color(1, 0, 0) },
    uBackgroundOutlineColor: { value: new Color(1, 0, 0) },
    uBackgroundOutlineWidth: { value: 0.1 },
    uFov: { value: 1.0 },
    uScreenHeightPx: { value: 1080.0 },
    uFarPlane: { value: 1000.0 },
    uTextWidth: { value: 0.0 },
    uTextHeight: { value: 0.0 },
    uBgYBounds: { value: new Vector2(0.0, 1.0) },
    uRTCCenter: {
      value: new Vector3(
        rtcCenter?.[0] ?? 0,
        rtcCenter?.[1] ?? 0,
        rtcCenter?.[2] ?? 0,
      ),
    },
    uEyeRTELow: { value: new Vector3(0, 0, 0) },
    uEyeRTEHigh: { value: new Vector3(0, 0, 0) },
    nvr_uBatchId: { value: batchId ?? 0 },
    nvr_uPickable: { value: 0.0 },
    uAtlas: { value: null },
  };

  // Conditional position uniforms based on RTE mode
  if (useRTE) {
    refs.uRTEPositionLOW = { value: new Vector3(0, 0, 0) };
    refs.uRTEPositionHIGH = { value: new Vector3(0, 0, 0) };
  } else {
    refs.uRTCPosition = { value: new Vector3(0, 0, 0) };
  }

  return {
    update: (state: SdfTextBaseState) => {
      refs.uColor.value.set(state.color);
      refs.uFontSize.value = state.fontSize;
      refs.uCenter.value.set(state.center[0], state.center[1]);
      refs.uSizeInMeters.value = state.sizeInMeters;
      refs.uAddHeight.value = state.addHeight;
      refs.uOffsetDepth.value = state.offsetDepth;
      refs.uOutlineWidth.value = state.outlineWidth;
      refs.uOutlineColor.value.set(state.outlineColor);
      refs.uOutlineOpacity.value = state.outlineOpacity;
      refs.uShowBackground.value = state.showBackground;
      refs.uBackgroundColor.value.set(state.backgroundColor);
      refs.uBackgroundOutlineColor.value.set(state.backgroundOutlineColor);
      refs.uBackgroundOutlineWidth.value = state.backgroundOutlineWidth;
      refs.nvr_uPickable.value = state.pickable ? 1.0 : 0.0;
    },

    updateUniforms: (uniforms) => {
      uniforms.uColor = refs.uColor;
      uniforms.uFontSize = refs.uFontSize;
      uniforms.uCenter = refs.uCenter;
      uniforms.uSizeInMeters = refs.uSizeInMeters;
      uniforms.uAddHeight = refs.uAddHeight;
      uniforms.uOffsetDepth = refs.uOffsetDepth;
      uniforms.uSdfThreshold = refs.uSdfThreshold;
      uniforms.uOutlineWidth = refs.uOutlineWidth;
      uniforms.uOutlineColor = refs.uOutlineColor;
      uniforms.uOutlineOpacity = refs.uOutlineOpacity;
      uniforms.uShowBackground = refs.uShowBackground;
      uniforms.uBackgroundColor = refs.uBackgroundColor;
      uniforms.uBackgroundOutlineColor = refs.uBackgroundOutlineColor;
      uniforms.uBackgroundOutlineWidth = refs.uBackgroundOutlineWidth;
      uniforms.uFov = refs.uFov;
      uniforms.uScreenHeightPx = refs.uScreenHeightPx;
      uniforms.uFarPlane = refs.uFarPlane;
      uniforms.uTextWidth = refs.uTextWidth;
      uniforms.uTextHeight = refs.uTextHeight;
      uniforms.uBgYBounds = refs.uBgYBounds;
      uniforms.uRTCCenter = refs.uRTCCenter;
      uniforms.uEyeRTELow = refs.uEyeRTELow;
      uniforms.uEyeRTEHigh = refs.uEyeRTEHigh;
      uniforms.nvr_uBatchId = refs.nvr_uBatchId;
      uniforms.nvr_uPickable = refs.nvr_uPickable;
      uniforms.uAtlas = refs.uAtlas;

      if (refs.uRTEPositionLOW) {
        uniforms.uRTEPositionLOW = refs.uRTEPositionLOW;
      }
      if (refs.uRTEPositionHIGH) {
        uniforms.uRTEPositionHIGH = refs.uRTEPositionHIGH;
      }
      if (refs.uRTCPosition) {
        uniforms.uRTCPosition = refs.uRTCPosition;
      }
    },

    updatePerFrame: (
      fov: number,
      screenHeight: number,
      farPlane: number,
      cameraX: number,
      cameraY: number,
      cameraZ: number,
      state: SdfTextBaseState,
    ) => {
      refs.uFov.value = fov;
      refs.uScreenHeightPx.value = screenHeight;
      refs.uFarPlane.value = farPlane;

      if (state.useRTE) {
        const encoded = encodePosition(cameraX, cameraY, cameraZ);
        refs.uEyeRTELow.value.set(encoded.low.x, encoded.low.y, encoded.low.z);
        refs.uEyeRTEHigh.value.set(
          encoded.high.x,
          encoded.high.y,
          encoded.high.z,
        );
      }
    },

    updateTextDimensions: (
      textWidth: number,
      textHeight: number,
      bgMinY: number,
      bgMaxY: number,
    ) => {
      refs.uTextWidth.value = textWidth;
      refs.uTextHeight.value = textHeight;
      refs.uBgYBounds.value.set(bgMinY, bgMaxY);
    },

    setAtlasTexture: (texture: UniformValue<DataTexture | null>) => {
      refs.uAtlas.value = texture.value;
    },

    setPosition: (
      position: Float32Array | { high: Float32Array; low: Float32Array },
      posUseRTE: boolean,
      posRtcCenter?: [number, number, number],
    ) => {
      if (posUseRTE) {
        const p = position as { high: Float32Array; low: Float32Array };
        refs.uRTEPositionLOW?.value.set(p.low[0], p.low[1], p.low[2] ?? 0.0);
        refs.uRTEPositionHIGH?.value.set(
          p.high[0],
          p.high[1],
          p.high[2] ?? 0.0,
        );
      } else {
        const p = position as Float32Array;
        refs.uRTCPosition?.value.set(p[0], p[1], p[2] ?? 0.0);

        if (posRtcCenter) {
          refs.uRTCCenter.value.set(
            posRtcCenter[0],
            posRtcCenter[1],
            posRtcCenter[2],
          );
        }
      }
    },

    setBatchId: (id: number) => {
      refs.nvr_uBatchId.value = id;
    },
  };
};
