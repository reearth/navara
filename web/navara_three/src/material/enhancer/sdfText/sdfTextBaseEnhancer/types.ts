import type { Color, DataTexture, Vector2, Vector3 } from "three";

import type { UniformValue } from "../../../types";
import type { Mutates } from "../../MaterialEnhancer";

/** Must match Rust SDF_RADIUS in navara_font/src/atlas.rs */
export const SDF_RADIUS = 6.0;

/**
 * Props for the sdfText base enhancer.
 */
export type SdfTextBaseProps = {
  // Immutable after mount
  useRTE?: boolean;

  // Mutable state
  color?: number; // hex color
  fontSize?: number;
  center?: [number, number];
  scaleByDistance?: boolean;
  addHeight?: number;
  offsetDepth?: boolean;
  outlineWidth?: number; // raw width, converted in state via SDF_RADIUS
  outlineColor?: number; // hex
  outlineOpacity?: number;
  showBackground?: boolean;
  backgroundColor?: number; // hex
  backgroundOutlineColor?: number; // hex
  backgroundOutlineWidth?: number;
  pickable?: boolean;

  // Material properties (set directly on material, not via uniforms)
  depthTest?: boolean;

  // External uniform refs / values (may change over time)
  rtcCenter?: [number, number, number];
  atlasTexture?: UniformValue<DataTexture | null>;
};

/**
 * Immutable state snapshot for the sdfText base enhancer.
 * Colors are stored as [r, g, b] tuples (0-1 range).
 */
export type SdfTextBaseState = Readonly<{
  // Immutable after mount
  useRTE: boolean;

  // Mutable
  color: [number, number, number];
  fontSize: number;
  center: [number, number];
  scaleByDistance: boolean;
  addHeight: number;
  offsetDepth: boolean;
  outlineWidth: number; // pre-converted: (raw * 0.5) / SDF_RADIUS
  outlineColor: [number, number, number];
  outlineOpacity: number;
  showBackground: boolean;
  backgroundColor: [number, number, number];
  backgroundOutlineColor: [number, number, number];
  backgroundOutlineWidth: number;
  pickable: boolean;

  // Material properties
  depthTest: boolean;
}>;

/**
 * Mutable references (uniforms) for the sdfText base enhancer.
 * These are shared references with shader.uniforms.
 * Internal type - not exposed externally.
 */
export type SdfTextBaseRefs = {
  uColor: UniformValue<Color>;
  uFontSizePx: UniformValue<number>;
  uCenter: UniformValue<Vector2>;
  uScaleByDistance: UniformValue<boolean>;
  uAddHeight: UniformValue<number>;
  uOffsetDepth: UniformValue<boolean>;
  uSdfThreshold: UniformValue<number>;
  uOutlineWidth: UniformValue<number>;
  uOutlineColor: UniformValue<Color>;
  uOutlineOpacity: UniformValue<number>;
  uShowBackground: UniformValue<boolean>;
  uBackgroundColor: UniformValue<Color>;
  uBackgroundOutlineColor: UniformValue<Color>;
  uBackgroundOutlineWidth: UniformValue<number>;
  uFov: UniformValue<number>;
  uScreenHeightPx: UniformValue<number>;
  uFarPlane: UniformValue<number>;
  uTextWidth: UniformValue<number>;
  uTextHeight: UniformValue<number>;
  uBgYBounds: UniformValue<Vector2>;
  uRTCCenter: UniformValue<Vector3>;
  uEyeRTELow: UniformValue<Vector3>;
  uEyeRTEHigh: UniformValue<Vector3>;
  nvr_uBatchId: UniformValue<number>;
  nvr_uPickable: UniformValue<number>;
  uAtlas: UniformValue<DataTexture | null>;

  // Conditional RTE/RTC position uniforms
  uRTEPositionLOW?: UniformValue<Vector3>;
  uRTEPositionHIGH?: UniformValue<Vector3>;
  uRTCPosition?: UniformValue<Vector3>;
};

export type SdfTextBaseUniforms = Partial<SdfTextBaseRefs>;

/**
 * Mutation functions for the sdfText base enhancer.
 */
export type SdfTextBaseMutates = Mutates<
  SdfTextBaseState,
  SdfTextBaseUniforms,
  {
    /**
     * Update per-frame camera uniforms (FOV, screen height, far plane, RTE eye).
     */
    updatePerFrame: (
      fov: number,
      screenHeight: number,
      farPlane: number,
      cameraX: number,
      cameraY: number,
      cameraZ: number,
      state: SdfTextBaseState,
    ) => void;
    /**
     * Update text dimension uniforms after text shaping.
     */
    updateTextDimensions: (
      textWidth: number,
      textHeight: number,
      bgMinY: number,
      bgMaxY: number,
    ) => void;
    /**
     * Set the SDF atlas texture external ref.
     */
    setAtlasTexture: (texture: UniformValue<DataTexture | null>) => void;
    /**
     * Update position uniforms (RTE or RTC).
     */
    setPosition: (
      position: Float32Array | { high: Float32Array; low: Float32Array },
      useRTE: boolean,
      rtcCenter?: [number, number, number],
    ) => void;
    /**
     * Set the batch ID uniform (immutable after mount, but needed for batch creation).
     */
    setBatchId: (batchId: number) => void;
  }
>;
