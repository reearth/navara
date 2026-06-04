/**
 * Shared state fields common to both instancedSprite paths — the billboard
 * (legacy GLSL `ShaderMaterial`) base enhancer and the point (TSL NodeMaterial)
 * enhancer. Each path extends these with its own path-specific fields (e.g.
 * billboard `alphaTest`/`aspect`, point `rtcCenter`) and supplies its own
 * uniform-flush logic; only the appearance/pipeline state shape and its
 * `props ?? current` merge live here so the two paths can't drift apart.
 */

/** Appearance/pipeline props shared by both sprite paths. */
export type SpriteCommonProps = {
  scale?: number;
  center?: [number, number];
  sizeInMeters?: boolean;
  offsetDepth?: boolean;
  pickable?: boolean;

  // SelectiveEffect.
  effectIdsMask?: number;
  emissiveColor?: number;
  emissiveIntensity?: number;

  // Material properties (set on the material / select the cached material).
  transparent?: boolean;
  depthTest?: boolean;
};

/** Immutable snapshot of the shared sprite state. */
export type SpriteCommonState = Readonly<{
  scale: number;
  center: [number, number];
  sizeInMeters: boolean;
  offsetDepth: boolean;
  pickable: boolean;
  effectIdsMask: number;
  emissiveColor: number;
  emissiveIntensity: number;
  transparent: boolean;
  depthTest: boolean;
}>;

/** Defaults for the shared sprite state. */
export const DEFAULT_SPRITE_COMMON_STATE: SpriteCommonState = {
  scale: 100.0,
  center: [0.0, 0.0],
  sizeInMeters: true,
  offsetDepth: true,
  pickable: false,
  effectIdsMask: 0,
  emissiveColor: 0,
  emissiveIntensity: 0,
  transparent: true,
  depthTest: true,
};

/**
 * Merge the shared fields from props over the current state.
 * Props override current values; missing props fall back to current.
 */
export const updateSpriteCommonState = (
  props: SpriteCommonProps,
  current: SpriteCommonState,
): SpriteCommonState => ({
  scale: props.scale ?? current.scale,
  center: props.center ?? current.center,
  sizeInMeters: props.sizeInMeters ?? current.sizeInMeters,
  offsetDepth: props.offsetDepth ?? current.offsetDepth,
  pickable: props.pickable ?? current.pickable,
  effectIdsMask: props.effectIdsMask ?? current.effectIdsMask,
  emissiveColor: props.emissiveColor ?? current.emissiveColor,
  emissiveIntensity: props.emissiveIntensity ?? current.emissiveIntensity,
  transparent: props.transparent ?? current.transparent,
  depthTest: props.depthTest ?? current.depthTest,
});
