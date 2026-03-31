import type { PolylineBaseProps, PolylineBaseState } from "./types";

export const DEFAULT_BASE_PROPS: Required<
  Omit<
    PolylineBaseProps,
    | "globeNormalTexture"
    | "batchDataTexture"
    | "minMaxHeight"
    | "viewportAndPixelRatio"
    | "frustumNearFar"
    | "frustumRatio"
    | "tGlobeDepth"
    | "inverseProjectionMatrix"
  >
> = {
  color: 0xffffff,
  width: 1,
  maxWidth: 1000,
  clampToGround: false,
  useGroundNormals: false,
  isTexturized: false,
  pickable: false,
  emissiveOnly: false,
  emissiveColor: 0,
  emissiveIntensity: 0,
  useRTE: false,
  batchColorEnabled: false,
  useBatchTexture: false,
  useBatchColorShow: false,
  useBatchHeight: false,
  useBatchExtrudedHeight: false,
};

/** Default state derived from DEFAULT_BASE_PROPS */
export const DEFAULT_BASE_STATE: PolylineBaseState = {
  useRTE: DEFAULT_BASE_PROPS.useRTE,
  isTexturized: DEFAULT_BASE_PROPS.isTexturized,
  clampToGround: DEFAULT_BASE_PROPS.clampToGround,
  useGroundNormals: DEFAULT_BASE_PROPS.useGroundNormals,
  pickable: DEFAULT_BASE_PROPS.pickable,
  emissiveOnly: false,
  emissiveColor: DEFAULT_BASE_PROPS.emissiveColor,
  emissiveIntensity: DEFAULT_BASE_PROPS.emissiveIntensity,
  minMaxHeight: [0, 0],
  width: DEFAULT_BASE_PROPS.width,
  maxWidth: DEFAULT_BASE_PROPS.maxWidth,
  color: DEFAULT_BASE_PROPS.color,
  batchColorEnabled: DEFAULT_BASE_PROPS.batchColorEnabled,
  useBatchTexture: DEFAULT_BASE_PROPS.useBatchTexture,
  useBatchColorShow: DEFAULT_BASE_PROPS.useBatchColorShow,
  useBatchHeight: DEFAULT_BASE_PROPS.useBatchHeight,
  useBatchExtrudedHeight: DEFAULT_BASE_PROPS.useBatchExtrudedHeight,
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
  props: PolylineBaseProps,
  currentState: PolylineBaseState,
): PolylineBaseState => {
  const isTexturized = props.isTexturized ?? currentState.isTexturized;

  return {
    // RTE cannot change after mount - always preserve current value
    useRTE: currentState.useRTE,
    isTexturized,
    clampToGround: props.clampToGround ?? currentState.clampToGround,
    // Ground normals are only applicable when not texturized
    useGroundNormals:
      !isTexturized &&
      (props.useGroundNormals ?? currentState.useGroundNormals),
    pickable: props.pickable ?? currentState.pickable,
    emissiveOnly: props.emissiveOnly ?? currentState.emissiveOnly,
    emissiveColor: props.emissiveColor ?? currentState.emissiveColor,
    emissiveIntensity:
      props.emissiveIntensity ?? currentState.emissiveIntensity,
    minMaxHeight: props.minMaxHeight ?? currentState.minMaxHeight,
    width: props.width ?? currentState.width,
    maxWidth: props.maxWidth ?? currentState.maxWidth,
    color: props.color ?? currentState.color,
    // Batch flags can only transition from false to true, never back
    batchColorEnabled:
      currentState.batchColorEnabled || !!props.batchColorEnabled,
    useBatchTexture: currentState.useBatchTexture || !!props.useBatchTexture,
    useBatchColorShow:
      currentState.useBatchColorShow || !!props.useBatchColorShow,
    useBatchHeight: currentState.useBatchHeight || !!props.useBatchHeight,
    useBatchExtrudedHeight:
      currentState.useBatchExtrudedHeight || !!props.useBatchExtrudedHeight,
  };
};
