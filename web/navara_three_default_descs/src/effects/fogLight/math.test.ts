import { describe, expect, it } from "vitest";

import {
  FOG_RANGE_EPSILON,
  effectiveRange,
  projectSphereBoundsNdc,
  tileContributionEstimate,
} from "./math";

/**
 * Exact projected extent of a sphere along one screen axis. The NDC
 * coordinate p * x / z over the sphere (x-cx)^2 + (y-cy)^2 + (z-cz)^2 = r^2
 * does not involve y, so its extremes lie on the circle of radius r around
 * (cx, cz) in the x-z plane; a dense sweep of that circle converges to the
 * true bounds (error O(step^2), far below the assertion tolerance).
 */
function sweepExtent(
  c: number,
  cz: number,
  r: number,
  p: number,
): [number, number] {
  const STEPS = 20000;
  let min = Infinity;
  let max = -Infinity;
  for (let k = 0; k < STEPS; k++) {
    const a = (k / STEPS) * Math.PI * 2;
    const x = c + r * Math.cos(a);
    const z = cz + r * Math.sin(a);
    const ndc = (p * x) / z;
    if (ndc < min) min = ndc;
    if (ndc > max) max = ndc;
  }
  return [min, max];
}

describe("effectiveRange", () => {
  it("matches the closed-form solution of I*D*(PI/h)/(1+k*h) = EPS", () => {
    const I = 1.5;
    const D = 2;
    const k = 0.1;
    const h = effectiveRange(I, D, Number.POSITIVE_INFINITY, k);
    const peak = ((Math.PI * I * D) / h) * (1 / (1 + k * h));
    expect(peak).toBeCloseTo(FOG_RANGE_EPSILON, 8);
  });

  it("is clamped by the user radius", () => {
    expect(effectiveRange(1, 2, 100, 0.1)).toBe(100);
  });

  it("grows with intensity and shrinks with falloff", () => {
    const base = effectiveRange(1, 2, 1e9, 0.1);
    expect(effectiveRange(4, 2, 1e9, 0.1)).toBeGreaterThan(base);
    expect(effectiveRange(1, 2, 1e9, 0.5)).toBeLessThan(base);
  });

  it("returns 0 for non-positive inputs", () => {
    expect(effectiveRange(0, 2, 100, 0.1)).toBe(0);
    expect(effectiveRange(1, 0, 100, 0.1)).toBe(0);
    expect(effectiveRange(1, 2, 0, 0.1)).toBe(0);
  });
});

describe("projectSphereBoundsNdc", () => {
  const p00 = 1.5;
  const p11 = 2.0;

  it("matches the exact projected extent of the sphere", () => {
    const out = new Float32Array(4);
    // Deterministic grid over depth, radius, and off-axis offsets, including
    // the near-limit r = 0.79 * cz the tile culling guarantees to stay under
    for (const cz of [50, 200, 1000]) {
      for (const rf of [0.1, 0.5, 0.79]) {
        for (const ox of [-0.6, 0, 0.6]) {
          for (const oy of [-0.6, 0.6]) {
            const r = rf * cz;
            const cx = ox * cz;
            const cy = oy * cz;
            expect(projectSphereBoundsNdc(cx, cy, cz, r, p00, p11, out)).toBe(
              true,
            );

            const [minX, maxX] = sweepExtent(cx, cz, r, p00);
            const [minY, maxY] = sweepExtent(cy, cz, r, p11);
            // Relative tolerance: `out` is Float32 and the sweep is a dense
            // approximation, so allow a small scale-aware epsilon
            const tolX = 1e-3 * (1 + Math.max(Math.abs(minX), Math.abs(maxX)));
            const tolY = 1e-3 * (1 + Math.max(Math.abs(minY), Math.abs(maxY)));

            // Coverage AND tightness: the bounds equal the true extent
            expect(Math.abs(out[0] - minX)).toBeLessThanOrEqual(tolX);
            expect(Math.abs(out[1] - maxX)).toBeLessThanOrEqual(tolX);
            expect(Math.abs(out[2] - minY)).toBeLessThanOrEqual(tolY);
            expect(Math.abs(out[3] - maxY)).toBeLessThanOrEqual(tolY);
          }
        }
      }
    }
  });

  it("reports degenerate projections (sphere reaching the camera plane)", () => {
    const out = new Float32Array(4);
    expect(projectSphereBoundsNdc(0, 0, 100, 100, p00, p11, out)).toBe(false);
  });
});

describe("tileContributionEstimate", () => {
  const R = 500;
  const I = 1;
  const k = 0.1;

  it("is zero at and beyond the effective range", () => {
    expect(tileContributionEstimate(R, R, I, k)).toBe(0);
    expect(tileContributionEstimate(R * 2, R, I, k)).toBe(0);
  });

  it("fades continuously to zero toward the range boundary", () => {
    const nearEdge = tileContributionEstimate(R * 0.999, R, I, k);
    const mid = tileContributionEstimate(R * 0.5, R, I, k);
    expect(nearEdge).toBeGreaterThan(0);
    expect(nearEdge).toBeLessThan(mid * 1e-2);
  });

  it("decreases monotonically with distance", () => {
    let prev = Number.POSITIVE_INFINITY;
    for (let h = R * 0.05; h < R; h += R * 0.05) {
      const v = tileContributionEstimate(h, R, I, k);
      expect(v).toBeLessThan(prev);
      prev = v;
    }
  });

  it("scales linearly with intensity", () => {
    const one = tileContributionEstimate(100, R, 1, k);
    const three = tileContributionEstimate(100, R, 3, k);
    expect(three).toBeCloseTo(one * 3, 6);
  });
});
