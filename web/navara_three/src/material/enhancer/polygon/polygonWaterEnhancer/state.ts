import type { PolygonWaterState, WaterOnlyProps } from "./types";

export const DEFAULT_WATER_PROPS: Required<WaterOnlyProps> = {
  water: false,
  waterScaleNormal: 0,
  waterSpeed: 0,
  shininess: 0,
  specularStrength: 0,
  applyWaterNormal: false,
  specular: false,
  ior: 1.33333,
  skyEnvMap: null,
  waterNormalMap: null,
  timeUniform: { value: 0 },
};

/** Default state derived from DEFAULT_WATER_PROPS */
export const DEFAULT_WATER_STATE: PolygonWaterState = {
  useWater: DEFAULT_WATER_PROPS.water,
  skyEnvMap: DEFAULT_WATER_PROPS.skyEnvMap,
  waterNormalMap: DEFAULT_WATER_PROPS.waterNormalMap,
  waterScaleNormal: DEFAULT_WATER_PROPS.waterScaleNormal,
  waterSpeed: DEFAULT_WATER_PROPS.waterSpeed,
  shininess: DEFAULT_WATER_PROPS.shininess,
  specularStrength: DEFAULT_WATER_PROPS.specularStrength,
  applyWaterNormal: DEFAULT_WATER_PROPS.applyWaterNormal,
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
  props: WaterOnlyProps,
  currentState: PolygonWaterState,
): PolygonWaterState => ({
  useWater: props.water ?? currentState.useWater,
  skyEnvMap: props.skyEnvMap ?? currentState.skyEnvMap,
  // Only update waterNormalMap when explicitly provided (not undefined)
  waterNormalMap:
    props.waterNormalMap !== undefined
      ? props.waterNormalMap
      : currentState.waterNormalMap,
  waterScaleNormal: props.waterScaleNormal ?? currentState.waterScaleNormal,
  waterSpeed: props.waterSpeed ?? currentState.waterSpeed,
  shininess: props.shininess ?? currentState.shininess,
  specularStrength: props.specularStrength ?? currentState.specularStrength,
  applyWaterNormal: props.applyWaterNormal ?? currentState.applyWaterNormal,
  specular: props.specular ?? currentState.specular,
  ior: props.ior ?? currentState.ior,
});
