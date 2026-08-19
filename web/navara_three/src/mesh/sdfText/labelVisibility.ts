import {
  getWGS84SemiMajorAxis,
  getWGS84SemiMinorAxis,
} from "@navaramap/three-api";
import { Matrix4, type PerspectiveCamera } from "three";

/**
 * Camera-derived state for testing whether a label anchor could appear on
 * screen. Snapshot it once per scan with {@link syncAnchorVisibilityState},
 * then test any number of anchors with {@link isAnchorPotentiallyVisible}.
 */
export type AnchorVisibilityState = {
  /** Column-major view-projection matrix. */
  vp: Float64Array;
  /** Camera world position (ECEF meters). */
  camX: number;
  camY: number;
  camZ: number;
};

export const createAnchorVisibilityState = (): AnchorVisibilityState => ({
  vp: new Float64Array(16),
  camX: 0,
  camY: 0,
  camZ: 0,
});

/**
 * Fractional tolerance on the Earth-surface radius band. An anchor whose
 * distance from the origin lands within this fraction of the WGS84 radii is
 * treated as sitting on the globe and gets the horizon test; anchors outside
 * the band (planar/local scenes, points far above the surface) rely on the
 * frustum test alone. 5% reaches from well below the polar radius up to the
 * equatorial radius plus high terrain and label height offsets — the band is a
 * "is this a globe anchor at all" filter, so it is deliberately loose.
 */
const EARTH_BAND_TOLERANCE = 0.05;

/**
 * Squared band bounds, derived from the engine's WGS84 ellipsoid (Rust side)
 * rather than from literals, so the band follows the engine's definition.
 * Resolved on first use, not at module scope: `@navaramap/three-api` only
 * answers once `view.init()` has initialized the WASM module. Memoized because
 * the bounds are tested once per anchor in the label scan.
 */
let bandMin2 = 0;
let bandMax2 = 0;

const resolveEarthBand = () => {
  const min = getWGS84SemiMinorAxis() * (1 - EARTH_BAND_TOLERANCE);
  const max = getWGS84SemiMajorAxis() * (1 + EARTH_BAND_TOLERANCE);
  bandMin2 = min * min;
  bandMax2 = max * max;
};

/**
 * Relaxation factor for the horizon test. `1` is the exact tangent-plane
 * cutoff; lowering it admits anchors slightly beyond the horizon so labels
 * near the limb start preparing (fonts fetching, glyphs shaping) before the
 * camera fully reveals them.
 */
const HORIZON_MARGIN = 0.95;

/**
 * Clip-space margin factor for the frustum test. `1` is the exact viewport;
 * `1.4` treats anchors within 40% beyond each edge as potentially visible, so
 * a label whose box pokes into view, or that is about to pan in, is prepared
 * slightly ahead of need.
 */
const NDC_MARGIN = 1.4;

const _view = new Matrix4();
const _viewProj = new Matrix4();

/**
 * Snapshot the camera into `out`. Derives the view matrix from `matrixWorld`
 * rather than trusting `matrixWorldInverse`, which can be stale outside the
 * render pass (same reasoning as `DeclutterManager._run`).
 */
export function syncAnchorVisibilityState(
  camera: PerspectiveCamera,
  out: AnchorVisibilityState,
): AnchorVisibilityState {
  _view.copy(camera.matrixWorld).invert();
  _viewProj.multiplyMatrices(camera.projectionMatrix, _view);
  out.vp.set(_viewProj.elements);
  const e = camera.matrixWorld.elements;
  out.camX = e[12];
  out.camY = e[13];
  out.camZ = e[14];
  return out;
}

/**
 * Whether a world-space (ECEF meters) anchor could appear on screen —
 * deliberately optimistic: `false` is only returned when the anchor is
 * provably out of view (behind the globe's horizon or well outside the
 * frustum), so callers can safely skip work for hidden anchors and never
 * miss a visible one.
 */
export function isAnchorPotentiallyVisible(
  state: AnchorVisibilityState,
  x: number,
  y: number,
  z: number,
): boolean {
  // Horizon: an anchor on the globe is beyond the horizon when the camera
  // sits below the anchor's tangent plane — dot(C, P) < |P|². Only applied
  // inside the Earth-surface band so non-globe anchors are never culled by it.
  if (bandMax2 === 0) resolveEarthBand();
  const r2 = x * x + y * y + z * z;
  if (
    r2 > bandMin2 &&
    r2 < bandMax2 &&
    x * state.camX + y * state.camY + z * state.camZ < r2 * HORIZON_MARGIN
  ) {
    return false;
  }

  // Frustum with margin. Near/far are ignored on purpose: an anchor beyond
  // the far plane is still "potentially visible" the moment the camera pulls
  // back, and being optimistic there costs at most one early preparation.
  const vp = state.vp;
  const w = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
  if (w <= 0) return false; // behind the camera
  const m = w * NDC_MARGIN;
  const cx = vp[0] * x + vp[4] * y + vp[8] * z + vp[12];
  if (cx < -m || cx > m) return false;
  const cy = vp[1] * x + vp[5] * y + vp[9] * z + vp[13];
  return cy >= -m && cy <= m;
}
