import { SelectiveEffectOcclusionMode } from "../../../../core";

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
  batchColorEnabled: false,
  useBatchTexture: false,
  useBatchColorShow: false,
  useBatchHeight: false,
  useBatchExtrudedHeight: false,
  bloom: false,
  outline: false,
  occlusion: SelectiveEffectOcclusionMode.Skip,
};

/** Default state derived from DEFAULT_BASE_PROPS */
export const DEFAULT_BASE_STATE: ModelBaseState = {
  pickable: DEFAULT_BASE_PROPS.pickable,
  batchColorEnabled: DEFAULT_BASE_PROPS.batchColorEnabled,
  useBatchTexture: DEFAULT_BASE_PROPS.useBatchTexture,
  useBatchColorShow: DEFAULT_BASE_PROPS.useBatchColorShow,
  useBatchHeight: DEFAULT_BASE_PROPS.useBatchHeight,
  useBatchExtrudedHeight: DEFAULT_BASE_PROPS.useBatchExtrudedHeight,
  bloom: DEFAULT_BASE_PROPS.bloom,
  outline: DEFAULT_BASE_PROPS.outline,
  occlusion: DEFAULT_BASE_PROPS.occlusion,
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
  // Batch flags can only transition from false to true, never back
  batchColorEnabled: props.batchColorEnabled ?? currentState.batchColorEnabled,
  useBatchTexture: props.useBatchTexture ?? currentState.useBatchTexture,
  useBatchColorShow: props.useBatchColorShow ?? currentState.useBatchColorShow,
  useBatchHeight: props.useBatchHeight ?? currentState.useBatchHeight,
  useBatchExtrudedHeight:
    props.useBatchExtrudedHeight ?? currentState.useBatchExtrudedHeight,
  // Selective effects - these are per-frame values, always take from props
  bloom: props.bloom ?? currentState.bloom,
  outline: props.outline ?? currentState.outline,
  occlusion: props.occlusion ?? currentState.occlusion,
});
