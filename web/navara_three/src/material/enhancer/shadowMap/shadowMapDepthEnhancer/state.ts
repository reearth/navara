import type { ShadowMapDepthProps, ShadowMapDepthState } from "./types";

export const DEFAULT_SHADOW_MAP_DEPTH_PROPS: Required<ShadowMapDepthProps> = {};

export const DEFAULT_SHADOW_MAP_DEPTH_STATE: ShadowMapDepthState = {};

/**
 * Update immutable state from props.
 * This enhancer has minimal state since it primarily holds external refs.
 *
 * @param _props - The props to apply (currently unused)
 * @param currentState - The current state to use as fallback
 */
export const updateState = (
  _props: ShadowMapDepthProps,
  _currentState: ShadowMapDepthState,
): ShadowMapDepthState => ({});
