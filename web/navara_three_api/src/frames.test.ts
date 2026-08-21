import { Matrix4, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { composeHeadingPitchRoll, nueToWunBasis } from "./frames";

// glTF 2.0: an asset's front faces +Z, its up is +Y, and -X is its right.
const FRONT = new Vector3(0, 0, 1);
const RIGHT = new Vector3(-1, 0, 0);

// Directions in the WUN local frame, where +x = west, +y = up, +z = north.
const NORTH = [0, 0, 1] as const;
const SOUTH = [0, 0, -1] as const;
const EAST = [-1, 0, 0] as const;
const WEST = [1, 0, 0] as const;
const UP = [0, 1, 0] as const;
const DOWN = [0, -1, 0] as const;

const expectDir = (
  m: Matrix4,
  axis: Vector3,
  expected: readonly [number, number, number],
) => {
  const actual = axis.clone().transformDirection(m);
  expect(actual.x).toBeCloseTo(expected[0], 6);
  expect(actual.y).toBeCloseTo(expected[1], 6);
  expect(actual.z).toBeCloseTo(expected[2], 6);
};

describe("composeHeadingPitchRoll", () => {
  it("faces north with no rotation, right hand to the east", () => {
    const m = composeHeadingPitchRoll(new Matrix4(), {});
    expectDir(m, FRONT, NORTH);
    expectDir(m, RIGHT, EAST);
  });

  it("reads heading as a clockwise compass bearing", () => {
    expectDir(
      composeHeadingPitchRoll(new Matrix4(), { heading: 0 }),
      FRONT,
      NORTH,
    );
    expectDir(
      composeHeadingPitchRoll(new Matrix4(), { heading: 90 }),
      FRONT,
      EAST,
    );
    expectDir(
      composeHeadingPitchRoll(new Matrix4(), { heading: 180 }),
      FRONT,
      SOUTH,
    );
    expectDir(
      composeHeadingPitchRoll(new Matrix4(), { heading: 270 }),
      FRONT,
      WEST,
    );
  });

  it("lifts the nose for positive pitch", () => {
    expectDir(composeHeadingPitchRoll(new Matrix4(), { pitch: 90 }), FRONT, UP);
    expectDir(
      composeHeadingPitchRoll(new Matrix4(), { pitch: -90 }),
      FRONT,
      DOWN,
    );
  });

  it("drops the right wing for positive roll, leaving the nose alone", () => {
    const m = composeHeadingPitchRoll(new Matrix4(), { roll: 90 });
    expectDir(m, RIGHT, DOWN);
    expectDir(m, FRONT, NORTH);
  });

  it("applies yaw, then pitch, then roll", () => {
    // Roll is innermost: it turns the asset about its own nose before pitch
    // tips that nose up, so the rolled right wing ends up pointing north.
    // Reversing the order would put the right wing east instead.
    const m = composeHeadingPitchRoll(new Matrix4(), { pitch: 90, roll: 90 });
    expectDir(m, FRONT, UP);
    expectDir(m, RIGHT, NORTH);
  });

  it("accepts uniform and per-axis scale", () => {
    const uniform = new Vector3().setFromMatrixScale(
      composeHeadingPitchRoll(new Matrix4(), { scale: 2.5 }),
    );
    expect(uniform.x).toBeCloseTo(2.5, 6);
    expect(uniform.y).toBeCloseTo(2.5, 6);
    expect(uniform.z).toBeCloseTo(2.5, 6);

    const perAxis = new Vector3().setFromMatrixScale(
      composeHeadingPitchRoll(new Matrix4(), { scale: { x: 2, y: 3, z: 4 } }),
    );
    expect(perAxis.x).toBeCloseTo(2, 6);
    expect(perAxis.y).toBeCloseTo(3, 6);
    expect(perAxis.z).toBeCloseTo(4, 6);
  });

  it("round-trips heading through a bearing, matching setCamera", () => {
    // navara_camera::helpers::get_heading yields 0 for north and 90 for east.
    // This test is the guard against the mesh and camera conventions drifting.
    for (const heading of [0, 17, 45, 90, 137, 180, 233, 270, 359]) {
      const front = FRONT.clone().transformDirection(
        composeHeadingPitchRoll(new Matrix4(), { heading }),
      );
      const bearing = (Math.atan2(-front.x, front.z) * 180) / Math.PI;
      expect((bearing + 360) % 360).toBeCloseTo(heading, 4);
    }
  });

  it("maps the asset front into ECEF through a real WUN frame", () => {
    // WUN at lng 0, lat 0: west = -Y_ecef, up = +X_ecef, north = +Z_ecef.
    const wun = new Matrix4().makeBasis(
      new Vector3(0, -1, 0),
      new Vector3(1, 0, 0),
      new Vector3(0, 0, 1),
    );
    expectDir(composeHeadingPitchRoll(wun, { heading: 0 }), FRONT, [0, 0, 1]);
    expectDir(composeHeadingPitchRoll(wun, { heading: 90 }), FRONT, [0, 1, 0]);
    expectDir(composeHeadingPitchRoll(wun, { pitch: 90 }), FRONT, [1, 0, 0]);
  });
});

describe("nueToWunBasis", () => {
  // navara_core's local_frame_to_fixed_frame builds
  //   east = normalize(-origin.y, origin.x, 0) and north = up x east,
  // so the ECEF axes at these two points are exact and hand-checkable.
  const cases = [
    {
      name: "lng 0, lat 0",
      up: new Vector3(1, 0, 0),
      east: new Vector3(0, 1, 0),
      north: new Vector3(0, 0, 1),
    },
    {
      name: "lng 90, lat 0",
      up: new Vector3(0, 1, 0),
      east: new Vector3(-1, 0, 0),
      north: new Vector3(0, 0, 1),
    },
  ];

  it.each(cases)(
    "turns an NUE basis into a WUN basis at $name",
    ({ up, east, north }) => {
      const nue = new Matrix4().makeBasis(north, up, east);
      const wun = new Matrix4().makeBasis(east.clone().negate(), up, north);
      const converted = nue.clone().multiply(nueToWunBasis());
      converted.elements.forEach((value, i) => {
        expect(value).toBeCloseTo(wun.elements[i], 6);
      });
    },
  );
});
