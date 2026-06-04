import type {
  InstancedSpritePointBaseProps,
  InstancedSpritePointBaseState,
} from "./types";

/** Default per-mesh point state. */
export const DEFAULT_POINT_BASE_STATE: InstancedSpritePointBaseState = {
  transparent: true,
  depthTest: true,
  scale: 100.0,
  center: [0.0, 0.0],
  sizeInMeters: true,
  offsetDepth: true,
  pickable: false,
  effectIdsMask: 0,
  emissiveColor: 0,
  emissiveIntensity: 0,
  rtcCenter: [0.0, 0.0, 0.0],
};

/**
 * Update per-mesh state from props.
 * Props override currentState values; missing props fall back to currentState.
 * Pass {@link DEFAULT_POINT_BASE_STATE} as currentState for the initial mount.
 */
export const updateState = (
  props: InstancedSpritePointBaseProps,
  currentState: InstancedSpritePointBaseState,
): InstancedSpritePointBaseState => {
  return {
    transparent: props.transparent ?? currentState.transparent,
    depthTest: props.depthTest ?? currentState.depthTest,
    scale: props.scale ?? currentState.scale,
    center: props.center ?? currentState.center,
    sizeInMeters: props.sizeInMeters ?? currentState.sizeInMeters,
    offsetDepth: props.offsetDepth ?? currentState.offsetDepth,
    pickable: props.pickable ?? currentState.pickable,
    effectIdsMask: props.effectIdsMask ?? currentState.effectIdsMask,
    emissiveColor: props.emissiveColor ?? currentState.emissiveColor,
    emissiveIntensity:
      props.emissiveIntensity ?? currentState.emissiveIntensity,
    rtcCenter: props.rtcCenter ?? currentState.rtcCenter,
  };
};
