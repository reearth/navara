import { Vector2 } from "three";
import { describe, expect, it } from "vitest";

import { isClickGesture } from "./pickHelper";

describe("isClickGesture", () => {
  it("accepts a mouseup at the exact mousedown position", () => {
    expect(isClickGesture(new Vector2(100, 100), new Vector2(100, 100))).toBe(
      true,
    );
  });

  it("accepts small jitter during a click (a few pixels)", () => {
    expect(isClickGesture(new Vector2(100, 100), new Vector2(102, 101))).toBe(
      true,
    );
    expect(isClickGesture(new Vector2(100, 100), new Vector2(97, 103))).toBe(
      true,
    );
  });

  it("accepts travel just under the 5px tolerance", () => {
    // 3-4-5 triangle scaled slightly down: distance ~4.99
    expect(isClickGesture(new Vector2(0, 0), new Vector2(2.99, 3.99))).toBe(
      true,
    );
  });

  it("rejects travel at or beyond the 5px tolerance", () => {
    expect(isClickGesture(new Vector2(0, 0), new Vector2(3, 4))).toBe(false);
    expect(isClickGesture(new Vector2(0, 0), new Vector2(5, 0))).toBe(false);
  });

  it("rejects a clear drag", () => {
    expect(isClickGesture(new Vector2(100, 100), new Vector2(180, 40))).toBe(
      false,
    );
  });

  it("uses euclidean distance, not per-axis deltas", () => {
    // Each axis moved less than 5px but the combined travel exceeds it.
    expect(isClickGesture(new Vector2(0, 0), new Vector2(4, 4))).toBe(false);
  });
});
