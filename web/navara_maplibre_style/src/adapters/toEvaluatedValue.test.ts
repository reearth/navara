import { describe, it, expect, vi } from "vitest";

import { JsStyleEngine } from "../engine/JsStyleEngine";
import type { StyleLayer } from "../engine/types";

// Mock @navara/three to avoid importing Three.js in tests
vi.mock("@navara/three", () => ({
  Color: class Color {
    r = 0;
    g = 0;
    b = 0;

    setRGB(r: number, g: number, b: number) {
      // Set RGB values directly (0-1 range)
      this.r = r;
      this.g = g;
      this.b = b;
      return this;
    }
  },
}));

import { createPaintEvaluators, toEvaluatedValue } from "./toEvaluatedValue";

describe("createPaintEvaluators", () => {
  const engine = new JsStyleEngine();

  it("should return empty object when no paint properties", () => {
    const layer: StyleLayer = {
      id: "test",
      type: "fill",
      source: "test",
    };

    const evaluators = createPaintEvaluators(layer, engine, "Polygon");

    expect(evaluators).toEqual({});
  });

  it("should create evaluators for fill paint properties", () => {
    const layer: StyleLayer = {
      id: "test",
      type: "fill",
      source: "test",
      paint: {
        "fill-color": "#ff0000",
        "fill-opacity": 0.5,
      },
    };

    const evaluators = createPaintEvaluators(layer, engine, "Polygon");

    expect(evaluators["fill-color"]).toBeDefined();
    expect(evaluators["fill-opacity"]).toBeDefined();

    // Test evaluation - MapLibre returns Color object
    const color = evaluators["fill-color"]({ properties: {} }) as any;
    expect(color.r).toBeCloseTo(1, 2);
    expect(color.g).toBeCloseTo(0, 2);
    expect(color.b).toBeCloseTo(0, 2);

    const opacity = evaluators["fill-opacity"]({ properties: {} });
    expect(opacity).toBe(0.5);
  });

  it("should create evaluators with expressions", () => {
    const layer: StyleLayer = {
      id: "test",
      type: "fill",
      source: "test",
      paint: {
        "fill-color": ["get", "color"],
      },
    };

    const evaluators = createPaintEvaluators(layer, engine, "Polygon");

    const colorEvaluator = evaluators["fill-color"];
    const color = colorEvaluator({ properties: { color: "#00ff00" } }) as any;
    expect(color.r).toBeCloseTo(0, 2);
    expect(color.g).toBeCloseTo(1, 2);
    expect(color.b).toBeCloseTo(0, 2);
  });

  it("should use default value when property value is undefined", () => {
    const layer: StyleLayer = {
      id: "test",
      type: "fill",
      source: "test",
      paint: {
        "fill-color": undefined,
      },
    };

    const evaluators = createPaintEvaluators(layer, engine, "Polygon");

    expect(evaluators["fill-color"]).toBeDefined();
    // Default fill-color is black
    const color = evaluators["fill-color"]({ properties: {} }) as any;
    expect(color.r).toBeCloseTo(0, 2);
    expect(color.g).toBeCloseTo(0, 2);
    expect(color.b).toBeCloseTo(0, 2);
  });
});

describe("toEvaluatedValue", () => {
  it("should convert fill-color Color object to Navara color", () => {
    const layer: StyleLayer = {
      id: "test",
      type: "fill",
      source: "test",
    };

    // MapLibre always returns Color objects from expression evaluation
    const paintValues = {
      "fill-color": { r: 1, g: 0, b: 0, a: 1 },
    };

    const result = toEvaluatedValue(layer, paintValues);

    expect(result.color).toBeDefined();
    expect(result.show).toBe(true);
  });

  it("should handle undefined color values", () => {
    const layer: StyleLayer = {
      id: "test",
      type: "fill",
      source: "test",
    };

    const paintValues = {
      "fill-color": undefined,
    };

    const result = toEvaluatedValue(layer, paintValues);

    expect(result.color).toBeUndefined();
    expect(result.show).toBe(true);
  });
});
