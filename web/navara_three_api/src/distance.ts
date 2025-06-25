import {
  getSurfaceDistance as nvGetSurfaceDistance,
  interpolateGeodeticPoints as nvInterpolateGeodeticPoints,
  LLE,
} from "@navara/engine-api";

export function getSurfaceDistance(start: LLE, end: LLE): number {
  return nvGetSurfaceDistance(start, end);
}

export function interpolateGeodeticPoints(
  start: LLE,
  end: LLE,
  numPoints: number,
): LLE[] {
  return nvInterpolateGeodeticPoints(start, end, numPoints);
}
