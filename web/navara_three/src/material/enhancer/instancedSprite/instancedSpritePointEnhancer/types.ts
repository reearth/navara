import type {
  SpriteCommonProps,
  SpriteCommonState,
} from "../spriteCommonState";

/**
 * Props for the instancedSprite **point** base enhancer.
 *
 * Unlike the billboard (GLSL) path, the point material is a TSL NodeMaterial
 * shared across many meshes, so these props become per-mesh state that the
 * enhancer flushes into the shared uniforms just-in-time. `transparent`/
 * `depthTest` (shared) cannot be expressed as a uniform, so changing them
 * re-selects a different cached material.
 *
 * Extends {@link SpriteCommonProps} with the point-only `rtcCenter`.
 */
export type InstancedSpritePointBaseProps = SpriteCommonProps & {
  // RTC anchor (non-RTE only); ignored under RTE which uses the camera uniforms.
  rtcCenter?: [number, number, number];
};

/**
 * Immutable per-mesh state snapshot for the point enhancer.
 * Always replaced as a whole (never mutated).
 */
export type InstancedSpritePointBaseState = SpriteCommonState &
  Readonly<{
    rtcCenter: [number, number, number];
  }>;
