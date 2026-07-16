import { Matrix4, PerspectiveCamera } from "three";
import { describe, expect, it } from "vitest";

import {
  isBeyondHorizon,
  projectCandidateInto,
  type ProjectionContext,
} from "./projection";
import type { DeclutterCandidate } from "./types";

const WGS84_A = 6378137.0;

const NOOP_OWNER = {
  collectDeclutterCandidates: () => {},
  applyDeclutter: () => {},
};

function makeCandidate(
  partial: Partial<DeclutterCandidate>,
): DeclutterCandidate {
  return {
    anchorX: 0,
    anchorY: 0,
    anchorZ: 0,
    addHeight: 0,
    minX: -10,
    maxX: 10,
    minY: -5,
    maxY: 5,
    sizeInMeters: false,
    priority: 0,
    owner: NOOP_OWNER,
    handle: 0,
    ...partial,
  };
}

/** Camera at the origin looking down -Z with a 90° vertical FOV, so
 *  tan(fov/2) = 1 and the px-per-meter math is easy to verify by hand. */
function makeContext(): ProjectionContext {
  const camera = new PerspectiveCamera(90, 800 / 600, 1, 1e9);
  camera.updateMatrixWorld(true);
  return {
    viewMatrix: new Matrix4().copy(camera.matrixWorld).invert(),
    projectionMatrix: camera.projectionMatrix,
    cameraX: 0,
    cameraY: 0,
    cameraZ: 0,
    near: camera.near,
    widthPx: 800,
    heightPx: 600,
    fovRad: Math.PI / 2,
  };
}

describe("projectCandidateInto", () => {
  it("centers a pixel-sized box on the projected anchor", () => {
    const ctx = makeContext();
    const out = new Float64Array(4);
    const ok = projectCandidateInto(
      makeCandidate({ anchorZ: -100 }),
      ctx,
      out,
      0,
    );

    expect(ok).toBe(true);
    // Anchor on the view axis lands at screen center; pixel-mode boxes are
    // used as-is (the shader's nvr_pxToWorld makes 1 unit = 1 px).
    expect(out[0]).toBeCloseTo(390);
    expect(out[1]).toBeCloseTo(295);
    expect(out[2]).toBeCloseTo(410);
    expect(out[3]).toBeCloseTo(305);
  });

  it("maps local +Y (view-space up) to decreasing screen Y", () => {
    const ctx = makeContext();
    const out = new Float64Array(4);
    projectCandidateInto(
      makeCandidate({ anchorZ: -100, minY: 0, maxY: 10 }),
      ctx,
      out,
      0,
    );

    // A box extending only upward from the anchor sits entirely above the
    // anchor's screen Y (300).
    expect(out[1]).toBeCloseTo(290);
    expect(out[3]).toBeCloseTo(300);
  });

  it("converts meter-sized boxes with the shader's |viewZ| distance", () => {
    const ctx = makeContext();
    const out = new Float64Array(4);
    projectCandidateInto(
      makeCandidate({
        anchorZ: -100,
        minX: -10,
        maxX: 10,
        minY: -10,
        maxY: 10,
        sizeInMeters: true,
      }),
      ctx,
      out,
      0,
    );

    // k = heightPx / (2 * tan(fov/2) * |viewZ|) = 600 / (2 * 1 * 100) = 3.
    expect(out[0]).toBeCloseTo(400 - 30);
    expect(out[1]).toBeCloseTo(300 - 30);
    expect(out[2]).toBeCloseTo(400 + 30);
    expect(out[3]).toBeCloseTo(300 + 30);
  });

  it("applies addHeight along the surface normal before projecting", () => {
    const ctx = makeContext();
    const out = new Float64Array(4);
    // Anchor at z=-100: the spherical normal is (0, 0, -1), so +50 m of
    // height pushes the label to z=-150 and shrinks meter-mode boxes.
    projectCandidateInto(
      makeCandidate({
        anchorZ: -100,
        addHeight: 50,
        minX: -10,
        maxX: 10,
        sizeInMeters: true,
      }),
      ctx,
      out,
      0,
    );

    // k = 600 / (2 * 1 * 150) = 2.
    expect(out[0]).toBeCloseTo(400 - 20);
    expect(out[2]).toBeCloseTo(400 + 20);
  });

  it("rejects anchors behind the camera or inside the near plane", () => {
    const ctx = makeContext();
    const out = new Float64Array(4);
    expect(
      projectCandidateInto(makeCandidate({ anchorZ: 100 }), ctx, out, 0),
    ).toBe(false);
    expect(
      projectCandidateInto(makeCandidate({ anchorZ: -0.5 }), ctx, out, 0),
    ).toBe(false);
  });
});

describe("isBeyondHorizon", () => {
  it("keeps the camera-facing side of the globe", () => {
    expect(isBeyondHorizon(WGS84_A, 0, 0, 2 * WGS84_A, 0, 0)).toBe(false);
  });

  it("culls the far side of the globe", () => {
    expect(isBeyondHorizon(-WGS84_A, 0, 0, 2 * WGS84_A, 0, 0)).toBe(true);
    // A point 90° around the limb is also below the horizon from a camera at
    // just one earth-radius of altitude.
    expect(isBeyondHorizon(0, WGS84_A, 0, 2 * WGS84_A, 0, 0)).toBe(true);
  });
});
