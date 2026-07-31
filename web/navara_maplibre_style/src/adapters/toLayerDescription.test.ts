import type { Source } from "@navaramap/three";
import { describe, it, expect, vi } from "vitest";

import type { StyleLayer } from "../engine/types";

import { toLayerDescription } from "./toLayerDescription";

describe("toLayerDescription", () => {
  // Mock source object
  const mockSource = {} as Source;

  describe("vector layers", () => {
    it("should convert fill layer", () => {
      const layer: StyleLayer = {
        id: "test-layer",
        type: "fill",
        source: "test",
        paint: {
          "fill-color": "#ff0000",
        },
      };

      const result = toLayerDescription(mockSource, layer);

      expect(result).not.toBeNull();
      expect(result?.type).toBe("vector");
      expect(result).toMatchObject({
        type: "vector",
        source: mockSource,
        polygon: {
          clampToGround: true,
        },
      });
    });

    it("should convert fill-extrusion layer", () => {
      const layer: StyleLayer = {
        id: "test-layer",
        type: "fill-extrusion",
        source: "test",
        paint: {
          "fill-extrusion-color": "#ff0000",
          "fill-extrusion-height": 100,
        },
      };

      const result = toLayerDescription(mockSource, layer);

      expect(result).not.toBeNull();
      expect(result?.type).toBe("vector");
      expect(result).toMatchObject({
        type: "vector",
        source: mockSource,
        polygon: {
          clampToGround: false,
        },
      });
    });

    it("should convert line layer", () => {
      const layer: StyleLayer = {
        id: "test-layer",
        type: "line",
        source: "test",
        paint: {
          "line-color": "#ff0000",
          "line-width": 2,
        },
      };

      const result = toLayerDescription(mockSource, layer);

      expect(result).not.toBeNull();
      expect(result?.type).toBe("vector");
      expect(result).toMatchObject({
        type: "vector",
        source: mockSource,
        polyline: {
          clampToGround: true,
        },
      });
    });

    it("should convert circle layer", () => {
      const layer: StyleLayer = {
        id: "test-layer",
        type: "circle",
        source: "test",
        paint: {
          "circle-color": "#ff0000",
          "circle-radius": 5,
        },
      };

      const result = toLayerDescription(mockSource, layer);

      expect(result).not.toBeNull();
      expect(result?.type).toBe("vector");
      expect(result).toMatchObject({
        type: "vector",
        source: mockSource,
        point: {
          clampToGround: true,
          center: { x: 0, y: -0.5 },
        },
      });
    });
  });

  describe("raster layers", () => {
    it("should convert raster layer", () => {
      const layer: StyleLayer = {
        id: "test-layer",
        type: "raster",
        source: "test",
      };

      const result = toLayerDescription(mockSource, layer);

      expect(result).not.toBeNull();
      expect(result?.type).toBe("raster");
      expect(result).toMatchObject({
        type: "raster",
        source: mockSource,
      });
    });

    it("should convert hillshade layer (paint properties not included in layer description)", () => {
      const layer: StyleLayer = {
        id: "test-layer",
        type: "hillshade",
        source: "test",
        paint: {
          "hillshade-exaggeration": 2.0,
        },
      };

      const result = toLayerDescription(mockSource, layer);

      expect(result).not.toBeNull();
      expect(result?.type).toBe("raster");
      expect(result).toMatchObject({
        type: "raster",
        source: mockSource,
        hillshade: {}, // Paint properties are handled during evaluation, not in layer description
      });
    });
  });

  describe("unsupported and misconfigured layers", () => {
    it("should warn and return null for unsupported layer type", () => {
      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      const layer = {
        id: "test-layer",
        type: "unsupported",
        source: "test",
      } as unknown as StyleLayer;

      const result = toLayerDescription(mockSource, layer);

      // Should return null instead of throwing
      expect(result).toBeNull();

      // Should log a warning with layer context
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Layer "test-layer"'),
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unsupported layer type "unsupported"'),
      );

      consoleWarnSpy.mockRestore();
    });

    it("should warn and return null for misconfigured symbol layer", () => {
      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      const layer: StyleLayer = {
        id: "empty-symbol",
        type: "symbol",
        source: "test",
        // No layout with icon-image or text-field
      };

      const result = toLayerDescription(mockSource, layer);

      // Should return null instead of throwing
      expect(result).toBeNull();

      // Should log a warning
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Symbol layer "empty-symbol"'),
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("no icon-image or text-field"),
      );

      consoleWarnSpy.mockRestore();
    });
  });
});
