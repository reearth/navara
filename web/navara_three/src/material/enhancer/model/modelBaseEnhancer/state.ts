import type { ModelBaseProps, ModelBaseState } from "./types";

export const DEFAULT_BASE_PROPS: Required<
  Omit<ModelBaseProps, "batchDataTexture">
> = {
  color: 0,
  metalness: 0,
  roughness: 0,
  emissiveColor: 0,
  emissiveIntensity: 0,
  pickable: false,
  selectiveEffectBufferMode: false,
  effectIdsMask: 0,
  batchColorEnabled: false,
  useBatchTexture: false,
  useBatchColorShow: false,
};

/** Default state derived from DEFAULT_BASE_PROPS */
export const DEFAULT_BASE_STATE: ModelBaseState = {
  pickable: DEFAULT_BASE_PROPS.pickable,
  selectiveEffectBufferMode: false,
  emissiveColor: DEFAULT_BASE_PROPS.emissiveColor,
  emissiveIntensity: DEFAULT_BASE_PROPS.emissiveIntensity,
  effectIdsMask: 0,
  batchColorEnabled: DEFAULT_BASE_PROPS.batchColorEnabled,
  useBatchTexture: DEFAULT_BASE_PROPS.useBatchTexture,
  useBatchColorShow: DEFAULT_BASE_PROPS.useBatchColorShow,
};

/**
 * Update immutable state from props.
 * Props override currentState values; missing props fall back to currentState.
 * Pass DEFAULT_BASE_STATE as currentState for initial mount.
 *
 * @param props - The props to apply
 * @param currentState - The current state to use as fallback (use DEFAULT_BASE_STATE for mount)
 */
export const updateState = (
  props: ModelBaseProps,
  currentState: ModelBaseState,
): ModelBaseState => ({
  pickable: props.pickable ?? currentState.pickable,
  selectiveEffectBufferMode:
    props.selectiveEffectBufferMode ?? currentState.selectiveEffectBufferMode,
  emissiveColor: props.emissiveColor ?? currentState.emissiveColor,
  emissiveIntensity: props.emissiveIntensity ?? currentState.emissiveIntensity,
  effectIdsMask: props.effectIdsMask ?? currentState.effectIdsMask,
  // Batch flags can only transition from false to true, never back
  batchColorEnabled: props.batchColorEnabled ?? currentState.batchColorEnabled,
  useBatchTexture: props.useBatchTexture ?? currentState.useBatchTexture,
  useBatchColorShow: props.useBatchColorShow ?? currentState.useBatchColorShow,
});
