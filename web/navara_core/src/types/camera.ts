import type { LngLatHeight } from "./unit";

export type CameraOrientation = {
  pitch?: number;
  heading?: number;
  roll?: number;
};

export type CameraPosition = Partial<LngLatHeight> & CameraOrientation;
