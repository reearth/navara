import { Color } from "three";

import {
  SDF_RADIUS,
  type SdfTextBaseProps,
  type SdfTextBaseState,
} from "./types";

const hexToColor = (hex: number): Color => {
  return new Color().setHex(hex);
};

export const DEFAULT_BASE_PROPS: Required<
  Omit<SdfTextBaseProps, "atlasTexture" | "rtcCenter">
> = {
  useRTE: false,
  color: 0xffffff,
  fontSize: 16.0,
  center: [0.5, 0.0],
  sizeInMeters: true,
  addHeight: 0.0,
  offsetDepth: true,
  outlineWidth: 0,
  outlineColor: 0x000000,
  outlineOpacity: 1.0,
  showBackground: false,
  backgroundColor: 0xff0000,
  backgroundOutlineColor: 0xff0000,
  backgroundOutlineWidth: 0.1,
  pickable: false,
  depthTest: true,
};

/** Default state derived from DEFAULT_BASE_PROPS */
export const DEFAULT_BASE_STATE: SdfTextBaseState = {
  useRTE: DEFAULT_BASE_PROPS.useRTE,
  color: hexToColor(DEFAULT_BASE_PROPS.color),
  fontSize: DEFAULT_BASE_PROPS.fontSize,
  center: DEFAULT_BASE_PROPS.center,
  sizeInMeters: DEFAULT_BASE_PROPS.sizeInMeters,
  addHeight: DEFAULT_BASE_PROPS.addHeight,
  offsetDepth: DEFAULT_BASE_PROPS.offsetDepth,
  outlineWidth: DEFAULT_BASE_PROPS.outlineWidth / SDF_RADIUS,
  outlineColor: hexToColor(DEFAULT_BASE_PROPS.outlineColor),
  outlineOpacity: DEFAULT_BASE_PROPS.outlineOpacity,
  showBackground: DEFAULT_BASE_PROPS.showBackground,
  backgroundColor: hexToColor(DEFAULT_BASE_PROPS.backgroundColor),
  backgroundOutlineColor: hexToColor(DEFAULT_BASE_PROPS.backgroundOutlineColor),
  backgroundOutlineWidth: DEFAULT_BASE_PROPS.backgroundOutlineWidth,
  pickable: DEFAULT_BASE_PROPS.pickable,
  depthTest: DEFAULT_BASE_PROPS.depthTest,
};

/**
 * Update mutable state from props.
 * Props override currentState values; missing props fall back to currentState.
 * Pass DEFAULT_BASE_STATE as currentState for initial mount.
 */
export const updateState = (
  props: SdfTextBaseProps,
  currentState: SdfTextBaseState,
): SdfTextBaseState => {
  return {
    // Immutable after mount
    useRTE: currentState.useRTE,
    // Mutable
    color:
      props.color !== undefined ? hexToColor(props.color) : currentState.color,
    fontSize: props.fontSize ?? currentState.fontSize,
    center: props.center ?? currentState.center,
    sizeInMeters: props.sizeInMeters ?? currentState.sizeInMeters,
    addHeight: props.addHeight ?? currentState.addHeight,
    offsetDepth: props.offsetDepth ?? currentState.offsetDepth,
    outlineWidth:
      props.outlineWidth !== undefined
        ? props.outlineWidth / SDF_RADIUS
        : currentState.outlineWidth,
    outlineColor:
      props.outlineColor !== undefined
        ? hexToColor(props.outlineColor)
        : currentState.outlineColor,
    outlineOpacity: props.outlineOpacity ?? currentState.outlineOpacity,
    showBackground: props.showBackground ?? currentState.showBackground,
    backgroundColor:
      props.backgroundColor !== undefined
        ? hexToColor(props.backgroundColor)
        : currentState.backgroundColor,
    backgroundOutlineColor:
      props.backgroundOutlineColor !== undefined
        ? hexToColor(props.backgroundOutlineColor)
        : currentState.backgroundOutlineColor,
    backgroundOutlineWidth:
      props.backgroundOutlineWidth ?? currentState.backgroundOutlineWidth,
    pickable: props.pickable ?? currentState.pickable,
    depthTest: props.depthTest ?? currentState.depthTest,
  };
};
