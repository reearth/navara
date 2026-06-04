import {
  DEFAULT_SPRITE_COMMON_STATE,
  updateSpriteCommonState,
} from "../spriteCommonState";

import type {
  InstancedSpritePointBaseProps,
  InstancedSpritePointBaseState,
} from "./types";

/** Default per-mesh point state. */
export const DEFAULT_POINT_BASE_STATE: InstancedSpritePointBaseState = {
  ...DEFAULT_SPRITE_COMMON_STATE,
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
): InstancedSpritePointBaseState => ({
  ...updateSpriteCommonState(props, currentState),
  rtcCenter: props.rtcCenter ?? currentState.rtcCenter,
});
