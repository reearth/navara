import type { LatLngHeight } from "@navaramap/core";
import {
  EllipsoidGeodesic as EllipsoidGeodesicImpl,
  LLE,
  angleToRadian,
  angleToDegree,
} from "@navaramap/engine-api";

/**
 * Wrapper class for geodesic calculations on an ellipsoid surface.
 * Precomputes common variables for optimization when instantiated.
 *
 * All latitudes/longitudes and headings are in **degrees**.
 *
 * @example
 * ```typescript
 * const geodesic = new EllipsoidGeodesic(
 *   { lat: 35.6812, lng: 139.7671, height: 0 },
 *   { lat: 34.7025, lng: 135.4959, height: 0 }
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
   * @param start - Start point in geodetic coordinates (lat/lng in degrees)
   * @param end - End point in geodetic coordinates (lat/lng in degrees)
   */
  constructor(start: LatLngHeight, end: LatLngHeight) {
    this._raw = new EllipsoidGeodesicImpl(
      new LLE(angleToRadian(start.lat), angleToRadian(start.lng), start.height),
      new LLE(angleToRadian(end.lat), angleToRadian(end.lng), end.height),
    );
  }

  /** Distance in meters between start and end points */
  get distance(): number {
    return this._raw.distance;
  }

  /**
   * Whether the geodesic solve converged. `false` for near-antipodal
   * endpoints, where `distance` is only a rough estimate and the
   * interpolation methods snap to the endpoints instead of following the
   * unreliable solution.
   */
  get converged(): boolean {
    return this._raw.converged;
  }

  /** Heading at the start point in degrees */
  get startHeading(): number {
    return angleToDegree(this._raw.start_heading);
  }

  /** Heading at the end point in degrees */
  get endHeading(): number {
    return angleToDegree(this._raw.end_heading);
  }

  /** Start point in geodetic coordinates (lat/lng in degrees) */
  get start(): LatLngHeight {
    const lle = this._raw.start;
    return {
      lat: angleToDegree(lle.lat),
      lng: angleToDegree(lle.lng),
      height: lle.height,
    };
  }

  /** End point in geodetic coordinates (lat/lng in degrees) */
  get end(): LatLngHeight {
    const lle = this._raw.end;
    return {
      lat: angleToDegree(lle.lat),
      lng: angleToDegree(lle.lng),
      height: lle.height,
    };
  }

  /**
   * Interpolate points along the geodesic path.
   * @param granularity - Distance between interpolated points in meters (optional)
   * @returns Array of interpolated points in geodetic coordinates (lat/lng in degrees)
   */
  interpolatePoints(granularity?: number): LatLngHeight[] {
    const wasmPoints = this._raw.interpolateGeodeticPoints(granularity ?? null);

    const results: LatLngHeight[] = [];
    for (const point of wasmPoints) {
      results.push({
        lat: angleToDegree(point.lat),
        lng: angleToDegree(point.lng),
        height: point.height,
      });
      point.free();
    }

    return results;
  }

  /**
   * Interpolate a point at a specific distance along the geodesic path.
   * @param distance - Distance from start point in meters
   * @returns Interpolated point in geodetic coordinates (lat/lng in degrees)
   */
  interpolateDistance(distance: number): LatLngHeight {
    const wasmPoint = this._raw.interpolateDistance(distance);

    const result: LatLngHeight = {
      lat: angleToDegree(wasmPoint.lat),
      lng: angleToDegree(wasmPoint.lng),
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
