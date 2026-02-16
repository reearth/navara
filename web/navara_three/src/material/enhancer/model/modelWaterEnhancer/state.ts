import type { ModelWaterOnlyProps, ModelWaterState } from "./types";

export const DEFAULT_WATER_PROPS: Required<ModelWaterOnlyProps> = {
  water: false,
  waterScaleNormal: 0,
  waterSpeed: 0,
  shininess: 0,
  specularStrength: 0,
  applyWaterNormal: false,
  specular: false,
  ior: 1.33333,
  reflectivity: 0,
  skyEnvMap: null,
  waterNormalMap: { value: null },
  timeUniform: { value: 0 },
  skyEnvMapUniform: { value: null },
};

/** Default state derived from DEFAULT_WATER_PROPS */
export const DEFAULT_WATER_STATE: ModelWaterState = {
  useWater: DEFAULT_WATER_PROPS.water,
  skyEnvMap: DEFAULT_WATER_PROPS.skyEnvMap,
  reflectivity: DEFAULT_WATER_PROPS.reflectivity,
  waterScaleNormal: DEFAULT_WATER_PROPS.waterScaleNormal,
  waterSpeed: DEFAULT_WATER_PROPS.waterSpeed,
  shininess: DEFAULT_WATER_PROPS.shininess,
  specularStrength: DEFAULT_WATER_PROPS.specularStrength,
  applyWaterNormal: !!DEFAULT_WATER_PROPS.applyWaterNormal,
  specular: DEFAULT_WATER_PROPS.specular,
  ior: DEFAULT_WATER_PROPS.ior,
};

/**
 * Update immutable state from props.
 * Props override currentState values; missing props fall back to currentState.
 * Pass DEFAULT_WATER_STATE as currentState for initial mount.
 *
 * @param props - The props to apply
 * @param currentState - The current state to use as fallback (use DEFAULT_WATER_STATE for mount)
 */
export const updateWaterState = (
  props: ModelWaterOnlyProps,
  currentState: ModelWaterState,
): ModelWaterState => ({
  useWater: props.water ?? currentState.useWater,
  skyEnvMap: props.skyEnvMap ?? currentState.skyEnvMap,
  reflectivity: props.reflectivity ?? currentState.reflectivity,
  waterScaleNormal: props.waterScaleNormal ?? currentState.waterScaleNormal,
  waterSpeed: props.waterSpeed ?? currentState.waterSpeed,
  shininess: props.shininess ?? currentState.shininess,
  specularStrength: props.specularStrength ?? currentState.specularStrength,
  // Keep boolean in state - cast to number only in refs
  applyWaterNormal:
    props.applyWaterNormal !== undefined
      ? !!props.applyWaterNormal
      : currentState.applyWaterNormal,
  specular: props.specular ?? currentState.specular,
  ior: props.ior ?? currentState.ior,
});
