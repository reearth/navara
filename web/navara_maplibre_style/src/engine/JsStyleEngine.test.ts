import { describe, it, expect } from "vitest";

import { JsStyleEngine } from "./JsStyleEngine";

describe("JsStyleEngine", () => {
  const engine = new JsStyleEngine();

  describe("parseStyle", () => {
    it("should parse valid style", async () => {
      const validStyle = {
        version: 8,
        sources: {
          test: {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          },
        },
        layers: [],
      };

      const parsed = await engine.parseStyle(validStyle);
      expect(parsed).toEqual(validStyle);
    });

    it("should throw error for invalid style version", async () => {
      const invalidStyle = {
        version: 7, // Invalid version
        sources: {},
        layers: [],
      };

      await expect(engine.parseStyle(invalidStyle)).rejects.toThrow(
        "Invalid MapLibre Style",
      );
    });

    it("should throw error for missing sources", async () => {
      const invalidStyle = {
        version: 8,
        // Missing sources
        layers: [],
      };

      await expect(engine.parseStyle(invalidStyle)).rejects.toThrow(
        "Invalid MapLibre Style",
      );
    });
  });

  describe("createFilter", () => {
    it("should create filter that returns true for all features when no filter", () => {
      // Empty array means no filter (all features pass)
      const filter = engine.createFilter([], "fill", "Polygon");

      expect(filter({ properties: { type: "park" } })).toBe(true);
      expect(filter({ properties: { type: "water" } })).toBe(true);
    });

    it("should create filter for equality comparison", () => {
      const filter = engine.createFilter(
        ["==", ["get", "type"], "park"],
        "fill",
        "Polygon",
      );

      expect(filter({ properties: { type: "park" } })).toBe(true);
      expect(filter({ properties: { type: "water" } })).toBe(false);
    });

    it("should create filter for numeric comparison", () => {
      const filter = engine.createFilter(
        [">", ["get", "population"], 1000],
        "fill",
        "Polygon",
      );

      expect(filter({ properties: { population: 2000 } })).toBe(true);
      expect(filter({ properties: { population: 500 } })).toBe(false);
    });

    it("should handle undefined properties", () => {
      const filter = engine.createFilter(
        ["==", ["get", "type"], "park"],
        "fill",
        "Polygon",
      );

      expect(filter({ properties: undefined })).toBe(false);
      expect(filter({ properties: {} })).toBe(false);
    });
  });

  describe("createValueFn", () => {
    it("should create function for constant color value", () => {
      const spec = { type: "color" as const, default: "#000000" };
      const valueFn = engine.createValueFn("#ff0000", spec, "Polygon");

      const result = valueFn({ properties: {} }) as any;
      // MapLibre returns a Color object with r, g, b properties (0-1 range)
      expect(result.r).toBeCloseTo(1, 2);
      expect(result.g).toBeCloseTo(0, 2);
      expect(result.b).toBeCloseTo(0, 2);
    });

    it("should create function for property get expression", () => {
      const spec = { type: "string" as const, default: "" };
      const valueFn = engine.createValueFn(["get", "name"], spec, "Polygon");

      expect(valueFn({ properties: { name: "test" } })).toBe("test");
      // MapLibre returns the default value (empty string) when property is missing
      expect(valueFn({ properties: {} })).toBe("");
    });

    it("should create function for case expression", () => {
      const spec = { type: "color" as const, default: "#000000" };
      const valueFn = engine.createValueFn(
        ["case", ["==", ["get", "type"], "park"], "#00ff00", "#ff0000"],
        spec,
        "Polygon",
      );

      const parkColor = valueFn({ properties: { type: "park" } }) as any;
      expect(parkColor.r).toBeCloseTo(0, 2);
      expect(parkColor.g).toBeCloseTo(1, 2);
      expect(parkColor.b).toBeCloseTo(0, 2);

      const waterColor = valueFn({ properties: { type: "water" } }) as any;
      expect(waterColor.r).toBeCloseTo(1, 2);
      expect(waterColor.g).toBeCloseTo(0, 2);
      expect(waterColor.b).toBeCloseTo(0, 2);
    });

    it("should throw error for invalid expression", () => {
      const spec = { type: "color" as const, default: "#000000" };

      expect(() => {
        engine.createValueFn(["invalid-op", "test"], spec, "Polygon");
      }).toThrow("Failed to create expression");
    });
  });

  describe("getPaintSpec", () => {
    it("should return spec for fill-color", () => {
      const spec = engine.getPaintSpec("fill", "fill-color");

      expect(spec).toBeDefined();
      expect(spec?.type).toBe("color");
    });

    it("should return spec for line-width", () => {
      const spec = engine.getPaintSpec("line", "line-width");

      expect(spec).toBeDefined();
      expect(spec?.type).toBe("number");
    });

    it("should return spec for circle-radius", () => {
      const spec = engine.getPaintSpec("circle", "circle-radius");

      expect(spec).toBeDefined();
      expect(spec?.type).toBe("number");
    });

    it("should return undefined for unknown property", () => {
      const spec = engine.getPaintSpec("fill", "unknown-property");

      expect(spec).toBeUndefined();
    });

    it("should return undefined for unsupported layer type", () => {
      const spec = engine.getPaintSpec("symbol" as any, "text-color");

      expect(spec).toBeUndefined();
    });
  });
});
