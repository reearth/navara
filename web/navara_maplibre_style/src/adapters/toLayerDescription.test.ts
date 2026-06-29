import { describe, it, expect, vi } from "vitest";

import type { ParsedStyle, StyleLayer } from "../engine/types";

import { toLayerDescription } from "./toLayerDescription";

// Mock @navara/three to avoid importing Three.js in tests
vi.mock("@navara/three", () => ({
  Color: class Color {
    r = 0;
    g = 0;
    b = 0;
    setHex() {
      return this;
    }
  },
}));

describe("toLayerDescription", () => {
  describe("GeoJSON source", () => {
    it("should convert fill layer with inline GeoJSON data", () => {
      const style: ParsedStyle = {
        version: 8,
        sources: {
          test: {
            type: "geojson",
            data: {
              type: "FeatureCollection",
              features: [],
            },
          },
        },
        layers: [],
      };

      const layer: StyleLayer = {
        id: "test-layer",
        type: "fill",
        source: "test",
        paint: {
          "fill-color": "#ff0000",
        },
      };

      const result = toLayerDescription(layer, style) as any;

      expect(result.type).toBe("geojson");
      expect(result.data).toEqual({
        type: "FeatureCollection",
        features: [],
      });
      expect(result.polygon).toBeDefined();
      expect(result.polygon?.color).toBeDefined();
    });

    it("should convert fill layer with URL data", () => {
      const style: ParsedStyle = {
        version: 8,
        sources: {
          test: {
            type: "geojson",
            data: "https://example.com/data.geojson",
          },
        },
        layers: [],
      };

      const layer: StyleLayer = {
        id: "test-layer",
        type: "fill",
        source: "test",
      };

      const result = toLayerDescription(layer, style);

      expect(result.type).toBe("geojson");
      expect(result.data).toEqual({
        url: "https://example.com/data.geojson",
      });
    });
  });

  describe("error handling", () => {
    it("should throw error for missing source", () => {
      const style: ParsedStyle = {
        version: 8,
        sources: {},
        layers: [],
      };

      const layer: StyleLayer = {
        id: "test-layer",
        type: "fill",
        source: "nonexistent",
      };

      expect(() => toLayerDescription(layer, style)).toThrow(
        'Source "nonexistent" not found in style',
      );
    });

    it("should throw error for unsupported source type", () => {
      const style: ParsedStyle = {
        version: 8,
        sources: {
          test: {
            type: "vector",
            tiles: ["https://example.com/{z}/{x}/{y}.pbf"],
          },
        },
        layers: [],
      };

      const layer: StyleLayer = {
        id: "test-layer",
        type: "fill",
        source: "test",
      };

      expect(() => toLayerDescription(layer, style)).toThrow(
        "Unsupported source type: vector",
      );
    });
  });
});
