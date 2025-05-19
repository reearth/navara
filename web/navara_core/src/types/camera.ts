import type { LatLngHeight } from "./geo";

export type CameraPosition = Partial<LatLngHeight> & {
  pitch?: number;
  heading?: number;
  roll?: number;
};

export type CameraPositionECEF = {
  x: number;
  y: number;
  z: number;
  pitch: number;
  heading: number;
  roll: number;
};

export type CRSTypes = "ecef" | "geographic";

export type CameraPositionByCRS<CRS extends CRSTypes> = CRS extends "geographic"
  ? CameraPosition
  : CameraPositionECEF;
