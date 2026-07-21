import { Color, Texture, Vector2 } from "three";
import { describe, expect, it } from "vitest";

import { createTestTileHandler } from "../../../../test-utils/engine";
import type { RasterCompositeLayer } from "../../../../tileTexture/types";

import {
  createCoreUniformMutates,
  type CompositeUniformTarget,
} from "./mutates";

// The real Rust `mercator_y` (clamped to the WM band), reached through the
// same context handler the app injects — the clamp regression below exercises
// the production implementation, not a reimplementation.
const { mercatorY } = createTestTileHandler();

const rasterLayer = (
  reproject: [number, number] | undefined,
): RasterCompositeLayer => ({
  absSlot: 0,
  region: "raster",
  texture: null,
  uvOffset: new Vector2(0, 0),
  uvScale: new Vector2(1, 1),
  kind: "raster",
  color: new Color(1, 1, 1),
  opacity: 1,
  water: false,
  reproject,
});

const bind = (reproject: [number, number] | undefined) => {
  const mutates = createCoreUniformMutates(mercatorY);
  const target: CompositeUniformTarget = {};
  mutates.attachUniforms(target, 1, new Texture());
  mutates.bindSlot(0, rasterLayer(reproject));
  return target;
};

describe("bindSlot Mercator reprojection constants", () => {
  it("clamps a polar latitude band to the WebMercator limit instead of NaN", () => {
    // A z0 Geographic terrain tile's band is ±90°, and Rust hands it over as
    // f32 — slightly PAST ±π/2, where an unclamped log(tan(...)) is NaN. A
    // NaN span fails the shader's `abs(mDen) > 1e-3` guard, silently skipping
    // reprojection for the whole tile (imagery squashes toward the equator).
    const f32HalfPi = Math.fround(Math.PI / 2);
    const target = bind([-f32HalfPi, f32HalfPi]);

    const merc = target.uReprojectMerc.value[0];
    // Band start/span from the clamped WM limit: mRs = -π, mDen = 2π.
    expect(merc.x).toBeCloseTo(-Math.PI, 5);
    expect(merc.y).toBeCloseTo(2 * Math.PI, 5);
    // Both edges sit on the WM limit → both polar-cap clamp flags set.
    expect(merc.z).toBe(1);
    expect(merc.w).toBe(1);
    expect(target.uReproject.value[0]).toBe(1);
  });

  it("keeps an interior band un-clamped and un-flagged", () => {
    const south = 0.2;
    const north = 0.7;
    const target = bind([south, north]);

    const merc = target.uReprojectMerc.value[0];
    expect(merc.x).toBeCloseTo(mercatorY(south), 9);
    expect(merc.y).toBeCloseTo(mercatorY(north) - mercatorY(south), 9);
    expect(merc.z).toBe(0);
    expect(merc.w).toBe(0);
  });

  it("flags but does not NaN a band touching one WM edge", () => {
    // z1 north Geographic tile: [0, 90°]. South edge is fine; the north edge
    // must clamp to the WM limit and set only the top polar-cap flag.
    const target = bind([0, Math.fround(Math.PI / 2)]);

    const merc = target.uReprojectMerc.value[0];
    expect(merc.x).toBeCloseTo(0, 9);
    expect(merc.y).toBeCloseTo(Math.PI, 5);
    expect(merc.z).toBe(1);
    expect(merc.w).toBe(0);
    expect(Number.isFinite(merc.y)).toBe(true);
  });
});
