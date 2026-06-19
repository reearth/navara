import { Color, Vector2, type Texture } from "three";
import { describe, expect, it } from "vitest";

import { planSlots, quantizeSlotCount } from "./SlotPlanner";
import type { CompositeLayer } from "./types";

const fakeTex = {} as unknown as Texture;

function rasterLayer(absSlot: number): CompositeLayer {
  return {
    kind: "raster",
    region: absSlot < 24 ? "raster" : "vector",
    absSlot,
    texture: fakeTex,
    uvOffset: new Vector2(0, 0),
    uvScale: new Vector2(1, 1),
    color: new Color(),
    opacity: 1,
    water: false,
  };
}

describe("quantizeSlotCount", () => {
  it("returns 0 when n is 0 — empty bucket contributes no slots", () => {
    expect(quantizeSlotCount(0, 32)).toBe(0);
    expect(quantizeSlotCount(-1, 32)).toBe(0);
  });

  it("rounds up to the next power of two", () => {
    expect(quantizeSlotCount(1, 32)).toBe(1);
    expect(quantizeSlotCount(2, 32)).toBe(2);
    expect(quantizeSlotCount(3, 32)).toBe(4);
    expect(quantizeSlotCount(5, 32)).toBe(8);
    expect(quantizeSlotCount(9, 32)).toBe(16);
    expect(quantizeSlotCount(17, 32)).toBe(32);
  });

  it("clamps to max", () => {
    expect(quantizeSlotCount(33, 32)).toBe(32);
    expect(quantizeSlotCount(100, 32)).toBe(32);
    // Non-power-of-two max: result is the bucket's quantised value capped.
    expect(quantizeSlotCount(7, 6)).toBe(6);
  });

  it("keeps exact powers of two intact", () => {
    expect(quantizeSlotCount(4, 32)).toBe(4);
    expect(quantizeSlotCount(16, 32)).toBe(16);
  });
});

describe("planSlots", () => {
  const BOUNDARY = 24;
  const MAX = 32;

  it("returns empty layout with no active layers", () => {
    const plan = planSlots([], BOUNDARY, MAX);
    expect(plan).toMatchObject({
      rasterCount: 0,
      vectorCount: 0,
      boundary: 24,
    });
    expect(plan.slots).toHaveLength(0);
  });

  it("quantizes each bucket's high-water mark independently", () => {
    // raster high-water at absSlot 2 → 3 → quantized 4; vector at 24 → 1.
    const plan = planSlots(
      [rasterLayer(0), rasterLayer(2), rasterLayer(24)],
      BOUNDARY,
      MAX,
    );
    expect(plan.rasterCount).toBe(4);
    expect(plan.vectorCount).toBe(1);
    expect(plan.slots).toHaveLength(5);
  });

  it("maps compact slots to absolute slots and skips the raster/vector gap", () => {
    const plan = planSlots(
      [rasterLayer(0), rasterLayer(1), rasterLayer(24)],
      BOUNDARY,
      MAX,
    );
    // Raster compact slots map 1:1; vector compact slot 2 jumps to abs 24.
    expect(plan.slots.map((s) => s.absSlot)).toEqual([0, 1, 24]);
    expect(plan.slots.map((s) => s.region)).toEqual([
      "raster",
      "raster",
      "vector",
    ]);
  });

  it("leaves inactive prefix slots without a layer", () => {
    // Only absSlot 2 active in the raster bucket → quantized to 4 slots,
    // slots 0,1,3 carry no layer.
    const layer = rasterLayer(2);
    const plan = planSlots([layer], BOUNDARY, MAX);
    expect(plan.rasterCount).toBe(4);
    expect(plan.slots.map((s) => s.layer)).toEqual([
      undefined,
      undefined,
      layer,
      undefined,
    ]);
  });
});
