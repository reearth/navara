import {
  DEFAULT_SPRITE_COMMON_STATE,
  updateSpriteCommonState,
} from "../spriteCommonState";

import type {
  InstancedSpriteBaseProps,
  InstancedSpriteBaseState,
} from "./types";

export const DEFAULT_BASE_PROPS: Required<
  Omit<InstancedSpriteBaseProps, "texture" | "rtcCenter">
> = {
  ...DEFAULT_SPRITE_COMMON_STATE,
  useRTE: false,
  billboard: false,
  alphaTest: 0.0,
  aspect: 1.0,
  fovRad: 1.0,
  screenHeightPx: 1080,
};

/** Default state derived from DEFAULT_BASE_PROPS */
export const DEFAULT_BASE_STATE: InstancedSpriteBaseState = {
  ...DEFAULT_SPRITE_COMMON_STATE,
  useRTE: DEFAULT_BASE_PROPS.useRTE,
  billboard: DEFAULT_BASE_PROPS.billboard,
  alphaTest: DEFAULT_BASE_PROPS.alphaTest,
  aspect: DEFAULT_BASE_PROPS.aspect,
  fovRad: DEFAULT_BASE_PROPS.fovRad,
  screenHeightPx: DEFAULT_BASE_PROPS.screenHeightPx,
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
    ...updateSpriteCommonState(props, currentState),
    // Immutable after mount - always preserve current value
    useRTE: currentState.useRTE,
    billboard: currentState.billboard,
    // Mutable billboard-only
    alphaTest: props.alphaTest ?? currentState.alphaTest,
    aspect: props.aspect ?? currentState.aspect,
    fovRad: props.fovRad ?? currentState.fovRad,
    screenHeightPx: props.screenHeightPx ?? currentState.screenHeightPx,
  };
};
