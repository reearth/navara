import type { XYZ } from "@navaramap/core";
import { Euler, MathUtils, Matrix4, Vector3 } from "three";

/**
 * High-level geographic placement of a mesh object.
 *
 * All angles are in **degrees** and `height` is in metres, matching
 * `ThreeView.setCamera`. The asset is oriented in a West-Up-North tangent
 * frame, which matches glTF's own convention (front `+Z`, up `+Y`,
 * right `-X`) on all three axes — so an unmodified glTF asset needs no
 * up-axis correction.
 */
export type GeodeticPlacement = {
  /** Longitude in degrees. */
  lng: number;
  /** Latitude in degrees. */
  lat: number;
  /**
   * Metres above the ellipsoid, or above terrain when `heightReference` is
   * `"terrain"`. Defaults to 0.
   */
  height?: number;
  /**
   * Degrees clockwise from north that the asset's front (glTF `+Z`) faces.
   * Same convention as `setCamera`'s heading. Defaults to 0.
   */
  heading?: number;
  /** Degrees, nose up positive. Defaults to 0. */
  pitch?: number;
  /** Degrees, right wing down positive. Defaults to 0. */
  roll?: number;
  /** Uniform or per-axis scale of the frame. Defaults to 1. */
  scale?: number | XYZ;
  /** How `height` is interpreted. Defaults to `"ellipsoid"`. */
  heightReference?: "ellipsoid" | "terrain";
};

/**
 * Basis change from the NUE frame `(north, up, east)` to the WUN frame
 * `(west, up, north)`.
 *
 * With `Ry(+90°)` columns `(0,0,-1), (0,1,0), (1,0,0)`, the product
 * `NUE · Ry(+90°)` has columns `(-east, up, north)`, which is WUN. WUN is the
 * unique right-handed, Y-up tangent frame whose `+Z` is north, which is why it
 * agrees with glTF on every axis.
 *
 * Returns a fresh matrix on every call, so callers cannot corrupt a shared
 * instance.
 *
 * @returns A new `Matrix4` performing the NUE-to-WUN basis change.
 */
export function nueToWunBasis(): Matrix4 {
  return new Matrix4().makeRotationY(Math.PI / 2);
}

/**
 * Composes a tangent frame with heading, pitch, roll and scale.
 *
 * Pure: takes the frame as a parameter and uses three.js `MathUtils.degToRad`,
 * so it touches no WASM and is directly unit-testable.
 *
 * `Ry(-heading) · Rx(-pitch) · Rz(+roll)` is exactly three.js Euler order
 * `"YXZ"`, the standard intrinsic yaw -> pitch -> roll order. Signs follow from
 * the glTF axes in a WUN frame: positive heading swings `+Z` toward `-X`
 * (east), positive pitch lifts `+Z` toward `+Y`, and positive roll about `+Z`
 * drives the `-X` wing toward `-Y`.
 *
 * @param frame - Tangent frame to compose onto, normally from
 *   `westUpNorthToFixedFrame`
 * @param p - Heading, pitch, roll (degrees) and scale; each defaults to
 *   no-op
 * @returns `frame · R(heading, pitch, roll) · S(scale)`
 */
export function composeHeadingPitchRoll(
  frame: Matrix4,
  p: Pick<GeodeticPlacement, "heading" | "pitch" | "roll" | "scale">,
): Matrix4 {
  const result = new Matrix4().multiplyMatrices(
    frame,
    new Matrix4().makeRotationFromEuler(
      new Euler(
        -MathUtils.degToRad(p.pitch ?? 0),
        -MathUtils.degToRad(p.heading ?? 0),
        MathUtils.degToRad(p.roll ?? 0),
        "YXZ",
      ),
    ),
  );

  if (p.scale !== undefined) {
    const s = p.scale;
    result.scale(
      typeof s === "number" ? new Vector3(s, s, s) : new Vector3(s.x, s.y, s.z),
    );
  }

  return result;
}
