import { Vector3 } from "three";
import { describe, expect, it, vi } from "vitest";

// The WASM math is covered by Rust unit tests; mock it with a transparent JS
// model so these tests exercise only the TypeScript wiring — specifically that
// the basis change is applied on the RIGHT (`multiply`, not `premultiply`) and that
// degrees are converted before reaching geodeticToXyz.
const SEMI_MAJOR = 6378137;

vi.mock("@navaramap/engine-api", () => {
  class LLE {
    constructor(
      public lat: number,
      public lng: number,
      public height: number,
    ) {}
    free() {}
  }
  class Vec3 {
    constructor(
      public x: number,
      public y: number,
      public z: number,
    ) {}
    free() {}
  }
  return {
    default: vi.fn(),
    LLE,
    Vec3,
    angleToRadian: (deg: number) => (deg * Math.PI) / 180,
    angleToDegree: (rad: number) => (rad * 180) / Math.PI,
    // Transparent model: the rotation is pinned to the NUE basis at
    // lng 0 / lat 0 (column-major: x = north (0,0,1), y = up (1,0,0),
    // z = east (0,1,0)), but the ORIGIN is threaded through from the
    // argument. Hardcoding the translation would make the
    // degree-conversion assertion below unobservable — it could never
    // fail, whatever the implementation did.
    northUpEastToFixedFrame: (origin: Vec3) => [
      0,
      0,
      1,
      0,
      1,
      0,
      0,
      0,
      0,
      1,
      0,
      0,
      origin.x,
      origin.y,
      origin.z,
      1,
    ],
    geodeticToXyz: (lle: LLE) => ({
      x: SEMI_MAJOR + lle.height,
      y: lle.lng,
      z: lle.lat,
      free() {},
    }),
  };
});

const { headingPitchRollToFixedFrame, westUpNorthToFixedFrame } =
  await import("./index");

describe("westUpNorthToFixedFrame", () => {
  it("turns the NUE columns into (-east, up, north)", () => {
    const wun = westUpNorthToFixedFrame(new Vector3(SEMI_MAJOR, 0, 0));

    // `makeRotationY(Math.PI / 2)` leaves cos(PI/2) = 6.1e-17 in the
    // matrix, so these are near-equalities, not exact ones.
    const expectColumn = (
      index: number,
      expected: readonly [number, number, number],
    ) => {
      const column = new Vector3().setFromMatrixColumn(wun, index);
      expect(column.x).toBeCloseTo(expected[0], 12);
      expect(column.y).toBeCloseTo(expected[1], 12);
      expect(column.z).toBeCloseTo(expected[2], 12);
    };

    expectColumn(0, [0, -1, 0]); // west
    expectColumn(1, [1, 0, 0]); // up
    expectColumn(2, [0, 0, 1]); // north
  });

  it("keeps the ECEF origin in the translation column", () => {
    const wun = westUpNorthToFixedFrame(new Vector3(SEMI_MAJOR, 0, 0));
    const origin = new Vector3().setFromMatrixPosition(wun);
    expect(origin.x).toBeCloseTo(SEMI_MAJOR, 6);
    expect(origin.y).toBeCloseTo(0, 12);
    expect(origin.z).toBeCloseTo(0, 12);
  });
});

describe("headingPitchRollToFixedFrame", () => {
  it("converts lng/lat from degrees before building the origin", () => {
    // The mock echoes the radian lng/lat back as y/z, so the conversion is
    // observable in the translation column.
    const m = headingPitchRollToFixedFrame({ lng: 180, lat: 90, height: 12 });
    const origin = new Vector3().setFromMatrixPosition(m);
    expect(origin.x).toBeCloseTo(SEMI_MAJOR + 12, 6);
    expect(origin.y).toBeCloseTo(Math.PI, 6);
    expect(origin.z).toBeCloseTo(Math.PI / 2, 6);
  });

  it("orients the asset front by heading in the WUN frame", () => {
    // At lng 0 / lat 0 the mocked frame gives ECEF north = +Z, east = +Y.
    const front = new Vector3(0, 0, 1);

    const north = front
      .clone()
      .transformDirection(
        headingPitchRollToFixedFrame({ lng: 0, lat: 0, heading: 0 }),
      );
    expect(north.x).toBeCloseTo(0, 6);
    expect(north.y).toBeCloseTo(0, 6);
    expect(north.z).toBeCloseTo(1, 6);

    const east = front
      .clone()
      .transformDirection(
        headingPitchRollToFixedFrame({ lng: 0, lat: 0, heading: 90 }),
      );
    expect(east.x).toBeCloseTo(0, 6);
    expect(east.y).toBeCloseTo(1, 6);
    expect(east.z).toBeCloseTo(0, 6);
  });

  it("defaults height to zero", () => {
    const m = headingPitchRollToFixedFrame({ lng: 0, lat: 0 });
    expect(new Vector3().setFromMatrixPosition(m).x).toBeCloseTo(SEMI_MAJOR, 6);
  });
});
