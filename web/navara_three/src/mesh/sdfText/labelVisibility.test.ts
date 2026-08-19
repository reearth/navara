import { PerspectiveCamera } from "three";
import { describe, expect, it, vi } from "vitest";

import {
  createAnchorVisibilityState,
  isAnchorPotentiallyVisible,
  syncAnchorVisibilityState,
} from "./labelVisibility";

// The ellipsoid getters cross into WASM, which is only initialized by
// `view.init()`. Stub them with the f32 values the engine returns (navara_core
// `WGS84_32`) so the radius band is exercised without a live view.
vi.mock("@navaramap/three-api", () => ({
  getWGS84SemiMajorAxis: () => 6_378_137,
  getWGS84SemiMinorAxis: () => 6_356_752.5,
}));

/** Equatorial Earth radius (m); anchors at this length get the horizon test. */
const R = 6_378_137;

function makeCamera(
  x: number,
  y: number,
  z: number,
  fov = 60,
): PerspectiveCamera {
  const cam = new PerspectiveCamera(fov, 1, 1, 1e9);
  cam.position.set(x, y, z);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  return cam;
}

function visible(
  cam: PerspectiveCamera,
  x: number,
  y: number,
  z: number,
): boolean {
  const state = syncAnchorVisibilityState(cam, createAnchorVisibilityState());
  return isAnchorPotentiallyVisible(state, x, y, z);
}

/** Surface anchor at `deg` degrees (around +Z) away from the sub-camera
 *  point of a camera on the +X axis. */
const surfaceAnchor = (deg: number): [number, number, number] => {
  const rad = (deg * Math.PI) / 180;
  return [R * Math.cos(rad), R * Math.sin(rad), 0];
};

describe("isAnchorPotentiallyVisible", () => {
  describe("globe horizon", () => {
    // Camera at 2R from the center: the geometric horizon sits at
    // acos(R / 2R) = 60° from the sub-camera point; HORIZON_MARGIN (0.95)
    // relaxes the cutoff to acos(0.95 / 2) ≈ 61.7°.
    const cam = makeCamera(2 * R, 0, 0);

    it("keeps the sub-camera point", () => {
      expect(visible(cam, ...surfaceAnchor(0))).toBe(true);
    });

    it("keeps anchors just past the horizon (margin)", () => {
      expect(visible(cam, ...surfaceAnchor(61))).toBe(true);
    });

    it("culls anchors clearly beyond the horizon", () => {
      expect(visible(cam, ...surfaceAnchor(63))).toBe(false);
    });

    it("culls the antipode", () => {
      expect(visible(cam, -R, 0, 0)).toBe(false);
    });

    it("never applies the horizon test outside the Earth-surface band", () => {
      // Same direction as the antipode but at non-globe scale: only the
      // frustum decides, and this point sits in front of the camera.
      expect(visible(cam, -1000, 0, 0)).toBe(true);
    });
  });

  describe("frustum", () => {
    // Camera at +Z looking at the origin; fov 60 and aspect 1 put the exact
    // frustum edge at |NDC| = 1 and the NDC_MARGIN (1.4) cutoff beyond it.
    const cam = makeCamera(0, 0, 1000);

    it("keeps anchors in front of the camera", () => {
      expect(visible(cam, 0, 0, 0)).toBe(true);
    });

    it("culls anchors behind the camera", () => {
      expect(visible(cam, 0, 0, 2000)).toBe(false);
    });

    it("keeps anchors slightly outside the viewport (margin)", () => {
      // At depth 1000 the frustum half-extent is tan(30°)·1000 ≈ 577; x=700
      // is ~1.2 in NDC — outside the screen but inside the 1.4 margin.
      expect(visible(cam, 700, 0, 0)).toBe(true);
    });

    it("culls anchors well outside the viewport", () => {
      // x=900 is ~1.56 in NDC, past the 1.4 margin.
      expect(visible(cam, 900, 0, 0)).toBe(false);
    });
  });
});
