import { describe, expect, it } from "vitest";

import {
  FOG_RANGE_EPSILON,
  effectiveRange,
  projectSphereBoundsNdc,
  tileContributionEstimate,
} from "./math";

// Deterministic pseudo-random sequence (tests must not depend on run order)
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
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
  it("bounds every projected point of the sphere surface", () => {
    const rand = lcg(1234);
    const p00 = 1.5;
    const p11 = 2.0;
    const out = new Float32Array(4);
    for (let iter = 0; iter < 200; iter++) {
      const cz = 50 + rand() * 2000;
      const r = rand() * cz * 0.8; // fully in front of the near plane
      const cx = (rand() - 0.5) * cz;
      const cy = (rand() - 0.5) * cz;
      expect(projectSphereBoundsNdc(cx, cy, cz, r, p00, p11, out)).toBe(true);

      let touchedMinX = false;
      let touchedMaxX = false;
      for (let s = 0; s < 500; s++) {
        // Uniform-ish direction on the sphere
        const u = rand() * 2 - 1;
        const phi = rand() * Math.PI * 2;
        const q = Math.sqrt(1 - u * u);
        const px = cx + r * q * Math.cos(phi);
        const py = cy + r * q * Math.sin(phi);
        const pz = cz + r * u;
        const ndcX = (p00 * px) / pz;
        const ndcY = (p11 * py) / pz;
        expect(ndcX).toBeGreaterThanOrEqual(out[0] - 1e-4);
        expect(ndcX).toBeLessThanOrEqual(out[1] + 1e-4);
        expect(ndcY).toBeGreaterThanOrEqual(out[2] - 1e-4);
        expect(ndcY).toBeLessThanOrEqual(out[3] + 1e-4);
        if (ndcX < out[0] + (out[1] - out[0]) * 0.02) touchedMinX = true;
        if (ndcX > out[1] - (out[1] - out[0]) * 0.02) touchedMaxX = true;
      }
      // Tightness: surface samples come close to both x bounds
      expect(touchedMinX || touchedMaxX).toBe(true);
    }
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
