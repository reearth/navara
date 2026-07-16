import type { Matrix4 } from "three";

import type { DeclutterCandidate } from "./types";

// Mirrors shaders/glsl/chunks/ellipsoid.glsl
const WGS84_A = 6378137.0;
const WGS84_B = 6356752.3142451793;

/** Everything needed to project candidates for one placement pass. */
export type ProjectionContext = {
  /** View matrix (inverse of the camera's `matrixWorld`). */
  viewMatrix: Matrix4;
  projectionMatrix: Matrix4;
  /** Camera world position in ECEF meters. */
  cameraX: number;
  cameraY: number;
  cameraZ: number;
  /** Near-plane distance in meters; anchors nearer than this are clipped. */
  near: number;
  /** Viewport size in CSS pixels — must match the `uScreenHeightPx` uniform. */
  widthPx: number;
  heightPx: number;
  /** Vertical field of view in radians — must match the `uFovRad` uniform. */
  fovRad: number;
};

/**
 * CPU mirror of `nvr_horizon_culled`
 * (shaders/glsl/chunks/horizon_culling_pars_vertex.glsl): true when the point
 * lies beyond the ellipsoidal horizon as seen from the camera, i.e. the GPU
 * will cull the label's vertices. Such labels must not claim collision space,
 * or an invisible label could suppress a visible one. Like the shader, the
 * test runs on the anchor *before* the height offset is applied.
 */
export function isBeyondHorizon(
  px: number,
  py: number,
  pz: number,
  cameraX: number,
  cameraY: number,
  cameraZ: number,
): boolean {
  const csx = cameraX / WGS84_A;
  const csy = cameraY / WGS84_A;
  const csz = cameraZ / WGS84_B;
  const vtx = csx - px / WGS84_A;
  const vty = csy - py / WGS84_A;
  const vtz = csz - pz / WGS84_B;
  const a = csx * csx + csy * csy + csz * csz - 1.0;
  return vtx * csx + vty * csy + vtz * csz > a;
}

/**
 * Project a candidate's local box to a screen-pixel AABB, mirroring the
 * billboard vertex shaders (sdfText.vert.glsl / instancedSprite.vert.glsl):
 *
 * - the anchor is lifted by `addHeight` along the spherical surface normal
 *   (`mvr_getMvHeightOffset`),
 * - pixel sizing uses `nvr_pxToWorld`, which measures distance as `|viewZ|`
 *   (not true range) — the CPU must reproduce that approximation or boxes
 *   drift from the rendered quads toward the screen edges,
 * - local +Y (view-space up) maps to decreasing screen Y.
 *
 * Writes `[minX, minY, maxX, maxY]` (y-down) into `out` at `offset` and
 * returns true; returns false without writing when the anchor is behind the
 * near plane. Horizon culling is a separate concern — see `isBeyondHorizon`.
 */
export function projectCandidateInto(
  c: DeclutterCandidate,
  ctx: ProjectionContext,
  out: Float64Array,
  offset: number,
): boolean {
  let wx = c.anchorX;
  let wy = c.anchorY;
  let wz = c.anchorZ;
  if (c.addHeight !== 0) {
    const len = Math.hypot(wx, wy, wz);
    if (len > 0) {
      const s = c.addHeight / len;
      wx += wx * s;
      wy += wy * s;
      wz += wz * s;
    }
  }

  const v = ctx.viewMatrix.elements;
  const vx = v[0] * wx + v[4] * wy + v[8] * wz + v[12];
  const vy = v[1] * wx + v[5] * wy + v[9] * wz + v[13];
  const vz = v[2] * wx + v[6] * wy + v[10] * wz + v[14];

  // In view space the camera looks down -Z; anything with vz >= -near is
  // behind the camera or clipped by the near plane.
  if (vz >= -ctx.near) return false;

  const p = ctx.projectionMatrix.elements;
  const cx = p[0] * vx + p[4] * vy + p[8] * vz + p[12];
  const cy = p[1] * vx + p[5] * vy + p[9] * vz + p[13];
  const cw = p[3] * vx + p[7] * vy + p[11] * vz + p[15];

  const sx = (cx / cw + 1.0) * 0.5 * ctx.widthPx;
  const sy = (1.0 - cy / cw) * 0.5 * ctx.heightPx;

  // Mirror of nvr_pxToWorld (shaders/glsl/chunks/pixelToWorld.glsl), inverted:
  // pixels per world meter at the anchor's view depth.
  let k = 1.0;
  if (c.sizeInMeters) {
    k = ctx.heightPx / (2.0 * Math.tan(ctx.fovRad / 2.0) * -vz);
  }

  out[offset] = sx + c.minX * k;
  out[offset + 1] = sy - c.maxY * k;
  out[offset + 2] = sx + c.maxX * k;
  out[offset + 3] = sy - c.minY * k;
  return true;
}
