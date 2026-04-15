import type { DataArrayTexture, Vector2, Vector3 } from "three";

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
  texture?: UniformValue<DataArrayTexture | null>;
  aspect?: number;
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
  aspect: number;
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
  uEyeRTELow: UniformValue<Vector3>;
  uEyeRTEHigh: UniformValue<Vector3>;
  uScale: UniformValue<number>;
  uCenter: UniformValue<Vector2>;
  uSizeInMeters: UniformValue<boolean>;
  uOffsetDepth: UniformValue<boolean>;
  uAlphaTest: UniformValue<number>;
  uFarPlane: UniformValue<number>;
  uAspect: UniformValue<number>;
  nvr_uPickable: UniformValue<number>;
  uEffectIdsMask: UniformValue<number>;
  uEmissiveColor: UniformValue<Vector3>;
  uEmissiveIntensity: UniformValue<number>;
  uFovRad: UniformValue<number>;
  uScreenHeightPx: UniformValue<number>;

  // External ref - only present in billboard mode
  uTexture?: UniformValue<DataArrayTexture | null>;
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
    setTexture: (texture: UniformValue<DataArrayTexture | null>) => void;
  }
>;
