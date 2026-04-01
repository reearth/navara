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
  emissiveOnly: false,
  effectIdsMode: false,
  effectIdsMask: 0,
  batchColorEnabled: false,
  useBatchTexture: false,
  useBatchColorShow: false,
  bloom: false,
  outline: false,
  occlusion: SelectiveEffectOcclusionMode.Skip,
};

/** Default state derived from DEFAULT_BASE_PROPS */
export const DEFAULT_BASE_STATE: ModelBaseState = {
  pickable: DEFAULT_BASE_PROPS.pickable,
  emissiveOnly: false,
  emissiveColor: DEFAULT_BASE_PROPS.emissiveColor,
  emissiveIntensity: DEFAULT_BASE_PROPS.emissiveIntensity,
  effectIdsMode: false,
  effectIdsMask: 0,
  batchColorEnabled: DEFAULT_BASE_PROPS.batchColorEnabled,
  useBatchTexture: DEFAULT_BASE_PROPS.useBatchTexture,
  useBatchColorShow: DEFAULT_BASE_PROPS.useBatchColorShow,
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
  emissiveOnly: props.emissiveOnly ?? currentState.emissiveOnly,
  emissiveColor: props.emissiveColor ?? currentState.emissiveColor,
  emissiveIntensity: props.emissiveIntensity ?? currentState.emissiveIntensity,
  effectIdsMode: props.effectIdsMode ?? currentState.effectIdsMode,
  effectIdsMask: props.effectIdsMask ?? currentState.effectIdsMask,
  // Batch flags can only transition from false to true, never back
  batchColorEnabled: props.batchColorEnabled ?? currentState.batchColorEnabled,
  useBatchTexture: props.useBatchTexture ?? currentState.useBatchTexture,
  useBatchColorShow: props.useBatchColorShow ?? currentState.useBatchColorShow,
  // Selective effects - these are per-frame values, always take from props
  bloom: props.bloom ?? currentState.bloom,
  outline: props.outline ?? currentState.outline,
  occlusion: props.occlusion ?? currentState.occlusion,
});
