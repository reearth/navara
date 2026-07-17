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

  it("accepts a non-exact color inside the shader's no-data band", () => {
    // 0.75 has no exact byte decomposition with unit scalers, but black
    // decodes to 0 and |0 - 0.75| <= 1, so the shader still flags it no-data.
    expect(demNoDataColorBytes({ x: 1, y: 1, z: 1 }, 0.75)).toEqual([0, 0, 0]);
  });

  it("returns null when no byte color decodes inside the no-data band", () => {
    // Boundary beyond the encodable range (max dot product is 765).
    expect(demNoDataColorBytes({ x: 1, y: 1, z: 1 }, 100000)).toBeNull();
    // Coarse scalers leave the nearest representable value a full step away.
    expect(demNoDataColorBytes({ x: 4, y: 0, z: 0 }, 6)).toBeNull();
  });
});
