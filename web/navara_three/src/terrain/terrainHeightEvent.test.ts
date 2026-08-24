import type { TerrainHeightUpdatedEvent } from "@navaramap/engine";
import { describe, expect, it } from "vitest";

import { hasObservedTerrainHeight } from "./terrainHeightEvent";

const BITS = 42n;

/** Only `bits` and `height` are read; the rest of the event is irrelevant here. */
const event = (height: number | undefined, bits = BITS) =>
  ({ bits, height }) as TerrainHeightUpdatedEvent;

describe("hasObservedTerrainHeight", () => {
  it("accepts a sea-level height of 0", () => {
    // Regression: a truthiness guard dropped 0, so a terrain refinement that
    // resolved to sea level never re-placed a `heightReference: "terrain"` mesh.
    expect(hasObservedTerrainHeight(event(0), BITS)).toBe(true);
  });

  it("accepts ordinary and negative heights", () => {
    expect(hasObservedTerrainHeight(event(910.5), BITS)).toBe(true);
    expect(hasObservedTerrainHeight(event(-12), BITS)).toBe(true);
  });

  it("rejects an absent height", () => {
    expect(hasObservedTerrainHeight(event(undefined), BITS)).toBe(false);
  });

  it("rejects an event for a different observer entity", () => {
    expect(hasObservedTerrainHeight(event(0, 7n), BITS)).toBe(false);
    expect(hasObservedTerrainHeight(event(910.5, 7n), BITS)).toBe(false);
  });
});
