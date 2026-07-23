import type { Matrix4, Texture, Vector2, Vector3 } from "three";

import type { UniformValue } from "../../../types";
import type { Mutates } from "../../MaterialEnhancer";

/**
 * Props for the instancedSprite base enhancer.
 */
export type InstancedSpriteBaseProps = {
  // Immutable after mount
  useRTE?: boolean;
  billboard?: boolean;

  // Mutable state
  scale?: number;
  center?: [number, number];
  sizeInMeters?: boolean;
  offsetDepth?: boolean;
  alphaTest?: number;
  pickable?: boolean;

  // SelectiveEffect
  effectIdsMask?: number;
  emissiveColor?: number;
  emissiveIntensity?: number;

  // Material properties (set directly on material, not via uniforms)
  transparent?: boolean;
  depthTest?: boolean;

  // External uniform refs / values (may change over time)
  rtcCenter?: [number, number, number];
  texture?: UniformValue<Texture | null>;
  /** Billboard atlas dimensions in pixels; normalizes instanceUvRect in the shader. */
  atlasSize?: [number, number];
  fovRad?: number;
  screenHeightPx?: number;
};

/**
 * Immutable state snapshot for the instancedSprite base enhancer.
 * This state is always replaced as a whole (never mutated).
 */
export type InstancedSpriteBaseState = Readonly<{
  // Immutable after mount
  useRTE: boolean;
  billboard: boolean;

  // Mutable
  scale: number;
  center: [number, number];
  sizeInMeters: boolean;
  offsetDepth: boolean;
  alphaTest: number;
  pickable: boolean;
  effectIdsMask: number;
  emissiveColor: number;
  emissiveIntensity: number;

  // Material properties
  transparent: boolean;
  depthTest: boolean;

  // External ref state
  atlasSize: [number, number];
  fovRad: number;
  screenHeightPx: number;
}>;

/**
 * Mutable references (uniforms) for the instancedSprite base enhancer.
 * These are shared references with shader.uniforms.
 * Internal type - not exposed externally.
 */
export type InstancedSpriteBaseRefs = {
  uRTCCenter: UniformValue<Vector3>;
  uRTCCenterView: UniformValue<Vector3>;
  uEyeRTELow: UniformValue<Vector3>;
  uEyeRTEHigh: UniformValue<Vector3>;
  /** Always 1.0 — blocks fast-math reassociation of the RTE recombination. */
  u_rteOne?: UniformValue<number>;
  uScale: UniformValue<number>;
  uCenter: UniformValue<Vector2>;
  uSizeInMeters: UniformValue<boolean>;
  uOffsetDepth: UniformValue<boolean>;
  uAlphaTest: UniformValue<number>;
  uFarPlane: UniformValue<number>;
  uAtlasSize: UniformValue<Vector2>;
  nvr_uPickable: UniformValue<number>;
  uEffectIdsMask: UniformValue<number>;
  uEmissiveColor: UniformValue<Vector3>;
  uEmissiveIntensity: UniformValue<number>;
  uFovRad: UniformValue<number>;
  uScreenHeightPx: UniformValue<number>;

  // External ref - only present in billboard mode
  uTexture?: UniformValue<Texture | null>;
};

export type InstancedSpriteBaseUniforms = Partial<InstancedSpriteBaseRefs>;

/**
 * Mutation functions for the instancedSprite base enhancer.
 */
export type InstancedSpriteBaseMutates = Mutates<
  InstancedSpriteBaseState,
  InstancedSpriteBaseUniforms,
  {
    /**
     * Update RTE uniforms per-frame.
     * Calls encodePosition internally to split camera position into high/low.
     */
    updateRteUniforms: (
      cameraX: number,
      cameraY: number,
      cameraZ: number,
      state: InstancedSpriteBaseState,
    ) => void;
    /**
     * Update the RTC uniforms per-frame. Transforms the RTC center into view
     * space on the CPU (float64) so the shader avoids a large-coordinate
     * float32 subtraction that would otherwise cause jitter.
     */
    updateRtcUniforms: (
      viewMatrix: Matrix4,
      state: InstancedSpriteBaseState,
    ) => void;
    /**
     * Update far plane per-frame from camera.
     */
    updateFarPlane: (far: number) => void;

    /**
     * Update FOV per-frame from camera, in radians.
     */
    updateFovRad: (fovRad: number) => void;

    /**
     * Update screen height per-frame from renderer size, in pixels.
     */
    updateScreenHeightPx: (height: number) => void;

    /**
     * Set texture external ref.
     */
    setTexture: (texture: UniformValue<Texture | null>) => void;
  }
>;
