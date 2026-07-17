import { describe, expect, it } from "vitest";

import { demNoDataColorBytes } from "./demNoDataColor";

describe("demNoDataColorBytes", () => {
  it("solves the Japan GSI boundary (2^23) to (128, 0, 0)", () => {
    expect(demNoDataColorBytes({ x: 65536, y: 256, z: 1 }, 8388608)).toEqual([
      128, 0, 0,
    ]);
  });

  it("solves the Mapbox boundary (10000) to (0, 39, 16)", () => {
    expect(demNoDataColorBytes({ x: 65536, y: 256, z: 1 }, 10000)).toEqual([
      0, 39, 16,
    ]);
  });

  it("solves the Terrarium boundary (0) to black", () => {
    expect(demNoDataColorBytes({ x: 256, y: 1, z: 1 / 256 }, 0)).toEqual([
      0, 0, 0,
    ]);
  });

  it("keeps channel order independent of scaler magnitude order", () => {
    // Same positional system with permuted channels: G is the coarse digit.
    expect(demNoDataColorBytes({ x: 256, y: 65536, z: 1 }, 8388608)).toEqual([
      0, 128, 0,
    ]);
  });

  it("returns null when the boundary is not byte-representable", () => {
    // Fractional boundary cannot be hit by integer bytes with unit scalers.
    expect(demNoDataColorBytes({ x: 1, y: 1, z: 1 }, 0.75)).toBeNull();
    // Boundary beyond the encodable range.
    expect(demNoDataColorBytes({ x: 1, y: 1, z: 1 }, 100000)).toBeNull();
  });
});
