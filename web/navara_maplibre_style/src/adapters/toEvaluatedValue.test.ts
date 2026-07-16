import { describe, it, expect, vi } from "vitest";

import { JsStyleEngine } from "../engine/JsStyleEngine";
import type { StyleLayer } from "../engine/types";

import { createPaintEvaluators, toEvaluatedValue } from "./toEvaluatedValue";

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

    setStyle(style: string) {
      // Simple color parser for testing fallback defaults
      if (style.startsWith("#")) {
        const hex = style.slice(1);
        this.r = parseInt(hex.slice(0, 2), 16) / 255;
        this.g = parseInt(hex.slice(2, 4), 16) / 255;
        this.b = parseInt(hex.slice(4, 6), 16) / 255;
      } else if (style.startsWith("rgb")) {
        const match = style.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (match) {
          this.r = parseInt(match[1]) / 255;
          this.g = parseInt(match[2]) / 255;
          this.b = parseInt(match[3]) / 255;
        }
      }
      return this;
    }
  },
}));

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

  it("should handle CSS string fallback defaults", () => {
    const layer: StyleLayer = {
      id: "test",
      type: "fill",
      source: "test",
    };

    // spec.default often returns CSS strings like "#000000"
    const paintValues = {
      "fill-color": "#ff0000",
    };

    const result = toEvaluatedValue(layer, paintValues);

    expect(result.color).toBeDefined();
    expect(result.show).toBe(true);
  });

  it("should handle invalid Color objects gracefully", () => {
    const layer: StyleLayer = {
      id: "test",
      type: "fill",
      source: "test",
    };

    // Invalid Color object with missing numeric fields
    const paintValues = {
      "fill-color": { r: 1, g: "invalid", b: 0 },
    };

    const result = toEvaluatedValue(layer, paintValues);

    // Should not crash, but color will be undefined
    expect(result.color).toBeUndefined();
    expect(result.show).toBe(true);
  });

  it("should map fill-opacity to result opacity", () => {
    const layer: StyleLayer = {
      id: "test",
      type: "fill",
      source: "test",
    };

    const paintValues = {
      "fill-color": { r: 1, g: 0, b: 0, a: 1 },
      "fill-opacity": 0.5,
    };

    const result = toEvaluatedValue(layer, paintValues);

    expect(result.opacity).toBeCloseTo(0.5, 2);
  });

  it("should use color alpha when no paint opacity specified", () => {
    const layer: StyleLayer = {
      id: "test",
      type: "fill",
      source: "test",
    };

    const paintValues = {
      "fill-color": { r: 1, g: 0, b: 0, a: 0.7 },
    };

    const result = toEvaluatedValue(layer, paintValues);

    expect(result.opacity).toBeCloseTo(0.7, 2);
  });

  it("should multiply color alpha with paint opacity", () => {
    const layer: StyleLayer = {
      id: "test",
      type: "fill",
      source: "test",
    };

    const paintValues = {
      "fill-color": { r: 1, g: 0, b: 0, a: 0.8 },
      "fill-opacity": 0.5,
    };

    const result = toEvaluatedValue(layer, paintValues);

    expect(result.opacity).toBeCloseTo(0.4, 2); // 0.8 * 0.5
  });

  it("should handle line-opacity for line layers", () => {
    const layer: StyleLayer = {
      id: "test",
      type: "line",
      source: "test",
    };

    const paintValues = {
      "line-color": { r: 0, g: 0, b: 1, a: 0.6 },
      "line-opacity": 0.5,
    };

    const result = toEvaluatedValue(layer, paintValues);

    expect(result.opacity).toBeCloseTo(0.3, 2); // 0.6 * 0.5
  });

  it("should handle circle-opacity for circle layers", () => {
    const layer: StyleLayer = {
      id: "test",
      type: "circle",
      source: "test",
    };

    const paintValues = {
      "circle-color": { r: 0, g: 1, b: 0, a: 1 },
      "circle-opacity": 0.75,
    };

    const result = toEvaluatedValue(layer, paintValues);

    expect(result.opacity).toBeCloseTo(0.75, 2);
  });

  it("should default to alpha 1.0 for CSS color strings", () => {
    const layer: StyleLayer = {
      id: "test",
      type: "fill",
      source: "test",
    };

    const paintValues = {
      "fill-color": "#ff0000",
    };

    const result = toEvaluatedValue(layer, paintValues);

    expect(result.opacity).toBeCloseTo(1.0, 2);
  });
});
