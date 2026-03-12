import type {
  InstancedSpriteBaseProps,
  InstancedSpriteBaseState,
} from "./types";

export const DEFAULT_BASE_PROPS: Required<
  Omit<InstancedSpriteBaseProps, "texture" | "rtcCenter">
> = {
  useRTE: false,
  billboard: false,
  scale: 100.0,
  center: [0.0, 0.0],
  scaleByDistance: true,
  offsetDepth: true,
  alphaTest: 0.0,
  pickable: false,
  transparent: true,
  depthTest: true,
  aspect: 1.0,
  fov: 50.0,
  screenHeight: 1080,
};

/** Default state derived from DEFAULT_BASE_PROPS */
export const DEFAULT_BASE_STATE: InstancedSpriteBaseState = {
  useRTE: DEFAULT_BASE_PROPS.useRTE,
  billboard: DEFAULT_BASE_PROPS.billboard,
  scale: DEFAULT_BASE_PROPS.scale,
  center: DEFAULT_BASE_PROPS.center,
  scaleByDistance: DEFAULT_BASE_PROPS.scaleByDistance,
  offsetDepth: DEFAULT_BASE_PROPS.offsetDepth,
  alphaTest: DEFAULT_BASE_PROPS.alphaTest,
  pickable: DEFAULT_BASE_PROPS.pickable,
  transparent: DEFAULT_BASE_PROPS.transparent,
  depthTest: DEFAULT_BASE_PROPS.depthTest,
  aspect: DEFAULT_BASE_PROPS.aspect,
  fov: DEFAULT_BASE_PROPS.fov,
  screenHeight: DEFAULT_BASE_PROPS.screenHeight,
};

/**
 * Update mutable state from props.
 * Props override currentState values; missing props fall back to currentState.
 * Pass DEFAULT_BASE_STATE as currentState for initial mount.
 *
 * @param props - The props to apply
 * @param currentState - The current state to use as fallback (use DEFAULT_BASE_STATE for mount)
 */
export const updateState = (
  props: InstancedSpriteBaseProps,
  currentState: InstancedSpriteBaseState,
): InstancedSpriteBaseState => {
  return {
    // Immutable after mount - always preserve current value
    useRTE: currentState.useRTE,
    billboard: currentState.billboard,
    // Mutable
    scale: props.scale ?? currentState.scale,
    center: props.center ?? currentState.center,
    scaleByDistance: props.scaleByDistance ?? currentState.scaleByDistance,
    offsetDepth: props.offsetDepth ?? currentState.offsetDepth,
    alphaTest: props.alphaTest ?? currentState.alphaTest,
    pickable: props.pickable ?? currentState.pickable,
    transparent: props.transparent ?? currentState.transparent,
    depthTest: props.depthTest ?? currentState.depthTest,
    aspect: props.aspect ?? currentState.aspect,
    fov: props.fov ?? currentState.fov,
    screenHeight: props.screenHeight ?? currentState.screenHeight,
  };
};
