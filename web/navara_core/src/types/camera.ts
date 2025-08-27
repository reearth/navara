import type { XYZ, LngLatHeight } from "./unit";

export type CameraPosition = LngLatHeight & {
  pitch?: number;
  heading?: number;
  roll?: number;
};

export type CameraPositionECEF = XYZ & {
  pitch: number;
  heading: number;
  roll: number;
};

export type CRSTypes = "ecef" | "geographic";

export type CameraPositionByCRS<CRS extends CRSTypes> = CRS extends "geographic"
  ? CameraPosition
  : CameraPositionECEF;
