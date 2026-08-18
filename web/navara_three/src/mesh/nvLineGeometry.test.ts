import { InterleavedBufferAttribute } from "three";
import { describe, expect, it } from "vitest";

import { NvLineGeometry } from "./nvLineGeometry";

// 4 vertices → 3 candidate segments (0-1, 1-2, 2-3)
const HIGH = new Float32Array([0, 0, 0, 10, 0, 0, 20, 0, 0, 30, 0, 0]);
const LOW = new Float32Array([0.1, 0, 0, 0.2, 0, 0, 0.3, 0, 0, 0.4, 0, 0]);

describe("NvLineGeometry.setPositionsHighLow", () => {
  it("builds interleaved start/end high/low attributes per segment", () => {
    const geometry = new NvLineGeometry();
    geometry.setPositionsHighLow(HIGH, LOW);

    const startHigh = geometry.getAttribute(
      "instanceStartHigh",
    ) as InterleavedBufferAttribute;
    const endHigh = geometry.getAttribute(
      "instanceEndHigh",
    ) as InterleavedBufferAttribute;
    const startLow = geometry.getAttribute(
      "instanceStartLow",
    ) as InterleavedBufferAttribute;
    const endLow = geometry.getAttribute(
      "instanceEndLow",
    ) as InterleavedBufferAttribute;

    // Same layout as LineSegmentsGeometry.setPositions: one interleaved
    // buffer of stride 6, start at offset 0, end at offset 3.
    expect(startHigh.data).toBe(endHigh.data);
    expect(startLow.data).toBe(endLow.data);
    expect(startHigh.data.stride).toBe(6);
    expect(startHigh.offset).toBe(0);
    expect(endHigh.offset).toBe(3);

    // 3 segments
    expect(startHigh.count).toBe(3);
    expect(startLow.count).toBe(3);

    // segment 1 = vertices 1 → 2
    expect(startHigh.getX(1)).toBe(10);
    expect(endHigh.getX(1)).toBe(20);
    expect(startLow.getX(1)).toBeCloseTo(0.2);
    expect(endLow.getX(1)).toBeCloseTo(0.3);
  });

  it("computes bounds from reconstructed high+low positions", () => {
    // setPositions is not called in RTE mode, so setPositionsHighLow must
    // provide the bounding volumes itself (culling / depth sorting read them).
    const geometry = new NvLineGeometry();
    geometry.setPositionsHighLow(HIGH, LOW);

    const box = geometry.boundingBox;
    const sphere = geometry.boundingSphere;
    expect(box).not.toBeNull();
    expect(sphere).not.toBeNull();

    // absolute x spans [0.1, 30.4], y = z = 0
    expect(box?.min.x).toBeCloseTo(0.1, 5);
    expect(box?.max.x).toBeCloseTo(30.4, 5);
    expect(box?.min.y).toBe(0);
    expect(box?.max.z).toBe(0);

    expect(sphere?.center.x).toBeCloseTo(15.25, 5);
    expect(sphere?.radius).toBeCloseTo(15.15, 5);
  });

  it("skips the same segments as setPositions", () => {
    const geometry = new NvLineGeometry();
    const skip = new Uint32Array([1]); // drop segment starting at vertex 1
    geometry.setPositions(HIGH, skip);
    geometry.setPositionsHighLow(HIGH, LOW, skip);

    const start = geometry.getAttribute(
      "instanceStart",
    ) as InterleavedBufferAttribute;
    const startHigh = geometry.getAttribute(
      "instanceStartHigh",
    ) as InterleavedBufferAttribute;

    expect(startHigh.count).toBe(2);
    expect(startHigh.count).toBe(start.count);

    // remaining segments are 0→1 and 2→3
    expect(startHigh.getX(0)).toBe(0);
    expect(startHigh.getX(1)).toBe(20);
  });
});
