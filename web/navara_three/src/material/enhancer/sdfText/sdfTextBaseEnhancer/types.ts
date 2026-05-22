import type { Color, DataTexture, Vector2, Vector3 } from "three";

import type { UniformValue } from "../../../types";
import type { Mutates } from "../../MaterialEnhancer";

/** Must match Rust SDF_RADIUS in navara_font/src/atlas.rs */
export const SDF_RADIUS = 35.0;

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
  sizeInMeters?: boolean;
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
 */
export type SdfTextBaseState = Readonly<{
  // Immutable after mount
  useRTE: boolean;

  // Mutable
  color: Color;
  fontSize: number;
  center: [number, number];
  sizeInMeters: boolean;
  addHeight: number;
  offsetDepth: boolean;
  outlineWidth: number; // pre-converted: raw / SDF_RADIUS
  outlineColor: Color;
  outlineOpacity: number;
  showBackground: boolean;
  backgroundColor: Color;
  backgroundOutlineColor: Color;
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
  uFontSize: UniformValue<number>;
  uCenter: UniformValue<Vector2>;
  uSizeInMeters: UniformValue<boolean>;
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
  uFovRad: UniformValue<number>;
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
  /** COLRv1 RGBA atlas. `null` when the font has no color glyphs. */
  uColorAtlas: UniformValue<DataTexture | null>;
  /** Current SDF atlas pixel dimensions; updated when the Rust atlas grows. */
  uSdfAtlasSize: UniformValue<Vector2>;
  /** Current color atlas pixel dimensions; updated when the color atlas grows. */
  uColorAtlasSize: UniformValue<Vector2>;

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
      fovRad: number,
      screenHeightPx: number,
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
     * Set the COLRv1 color atlas texture external ref.
     */
    setColorAtlasTexture: (texture: UniformValue<DataTexture | null>) => void;
    /**
     * Sync the atlas-size uniforms with the currently-bound atlas textures.
     * Cheap to call every frame; the shader divides glyph pixel rects by these
     * to derive UVs, so this is how atlas resizes propagate to existing meshes.
     */
    updateAtlasSizes: () => void;
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
