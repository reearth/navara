/**
 * Props for the instancedSprite **point** base enhancer.
 *
 * Unlike the billboard (GLSL) path, the point material is a TSL NodeMaterial
 * shared across many meshes, so these props become per-mesh state that the
 * enhancer flushes into the shared uniforms just-in-time (see {@link flush}).
 * `transparent`/`depthTest` cannot be expressed as a uniform, so changing them
 * re-selects a different cached material.
 */
export type InstancedSpritePointBaseProps = {
  // Pipeline state — selects which cached material is bound (not a uniform).
  transparent?: boolean;
  depthTest?: boolean;

  // Per-mesh uniform state.
  scale?: number;
  center?: [number, number];
  sizeInMeters?: boolean;
  offsetDepth?: boolean;
  pickable?: boolean;

  // SelectiveEffect.
  effectIdsMask?: number;
  emissiveColor?: number;
  emissiveIntensity?: number;

  // RTC anchor (non-RTE only); ignored under RTE which uses the camera uniforms.
  rtcCenter?: [number, number, number];
};

/**
 * Immutable per-mesh state snapshot for the point enhancer.
 * Always replaced as a whole (never mutated).
 */
export type InstancedSpritePointBaseState = Readonly<{
  transparent: boolean;
  depthTest: boolean;
  scale: number;
  center: [number, number];
  sizeInMeters: boolean;
  offsetDepth: boolean;
  pickable: boolean;
  effectIdsMask: number;
  emissiveColor: number;
  emissiveIntensity: number;
  rtcCenter: [number, number, number];
}>;
