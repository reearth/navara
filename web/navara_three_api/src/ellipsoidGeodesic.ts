import type { LatLngHeight } from "@navara/core";
import {
  EllipsoidGeodesic as EllipsoidGeodesicImpl,
  LLE,
} from "@navara/engine-api";

/**
 * Wrapper class for geodesic calculations on an ellipsoid surface.
 * Precomputes common variables for optimization when instantiated.
 *
 * @example
 * ```typescript
 * const geodesic = new EllipsoidGeodesic(
 *   { lat: 0.5, lng: 2.0, height: 0 },
 *   { lat: 0.6, lng: 2.1, height: 0 }
 * );
 *
 * console.log(geodesic.distance);
 * const points = geodesic.interpolatePoints(1000);
 * const midpoint = geodesic.interpolateDistance(geodesic.distance / 2);
 *
 * geodesic.dispose(); // Free WASM memory when done
 * ```
 */
export class EllipsoidGeodesic {
  private _raw: EllipsoidGeodesicImpl;

  /**
   * Create a new geodesic between two points on the ellipsoid.
   * @param start - Start point in geodetic coordinates (lat/lng in radians)
   * @param end - End point in geodetic coordinates (lat/lng in radians)
   */
  constructor(start: LatLngHeight, end: LatLngHeight) {
    this._raw = new EllipsoidGeodesicImpl(
      new LLE(start.lat, start.lng, start.height),
      new LLE(end.lat, end.lng, end.height),
    );
  }

  /** Distance in meters between start and end points */
  get distance(): number {
    return this._raw.distance;
  }

  /** Heading at the start point in radians */
  get startHeading(): number {
    return this._raw.start_heading;
  }

  /** Heading at the end point in radians */
  get endHeading(): number {
    return this._raw.end_heading;
  }

  /** Start point in geodetic coordinates */
  get start(): LatLngHeight {
    const lle = this._raw.start;
    return { lat: lle.lat, lng: lle.lng, height: lle.height };
  }

  /** End point in geodetic coordinates */
  get end(): LatLngHeight {
    const lle = this._raw.end;
    return { lat: lle.lat, lng: lle.lng, height: lle.height };
  }

  /**
   * Interpolate points along the geodesic path.
   * @param granularity - Distance between interpolated points in meters (optional)
   * @returns Array of interpolated points in geodetic coordinates
   */
  interpolatePoints(granularity?: number): LatLngHeight[] {
    const wasmPoints = this._raw.interpolateGeodeticPoints(granularity ?? null);

    const results: LatLngHeight[] = [];
    for (const point of wasmPoints) {
      results.push({
        lat: point.lat,
        lng: point.lng,
        height: point.height,
      });
      point.free();
    }

    return results;
  }

  /**
   * Interpolate a point at a specific distance along the geodesic path.
   * @param distance - Distance from start point in meters
   * @returns Interpolated point in geodetic coordinates
   */
  interpolateDistance(distance: number): LatLngHeight {
    const wasmPoint = this._raw.interpolateDistance(distance);

    const result: LatLngHeight = {
      lat: wasmPoint.lat,
      lng: wasmPoint.lng,
      height: wasmPoint.height,
    };

    wasmPoint.free();

    return result;
  }

  /**
   * Free WASM memory. Call this when the geodesic is no longer needed.
   */
  dispose(): void {
    this._raw.free();
  }
}
