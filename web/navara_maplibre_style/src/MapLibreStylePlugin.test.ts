import type {
  LayerSpecification,
  StyleSpecification,
} from "@maplibre/maplibre-gl-style-spec";
import type ThreeView from "@navaramap/three";
import type { ViewContext } from "@navaramap/three";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { StyleEngine } from "./engine/StyleEngine";
import { MapLibreStylePlugin } from "./MapLibreStylePlugin";

// Mock @navaramap/core - Plugin is imported from here
vi.mock("@navaramap/core", () => ({
  Plugin: vi.fn(),
}));

// Mock @navaramap/three - provides ThreeView default export and elevation decoders
// Note: All mock definitions must be inline since vi.mock is hoisted
vi.mock("@navaramap/three", () => {
  // Define mock class inside the factory
  class MockThreeView {
    addSource = vi.fn();
    addLayer = vi.fn();
  }

  return {
    default: MockThreeView, // Default export for ThreeView
    TERRARIUM_ELEVATION_DECODER: () => ({ type: "terrarium" }),
    MAPBOX_ELEVATION_DECODER: () => ({ type: "mapbox" }),
    JAPAN_GSI_ELEVATION_DECODER: () => ({ type: "gsi" }),
  };
});

// Get mock functions after imports
const mockAddSource = vi.fn();
const mockAddLayer = vi.fn();
const mockSourceDelete = vi.fn();
const mockLayerDelete = vi.fn();
const mockLayerOn = vi.fn();

// Mock ViewContext - empty object is sufficient for these tests
const mockViewContext: ViewContext = {} as ViewContext;

// Create mock view that matches ThreeView interface
function createMockView(): ThreeView {
  mockAddSource.mockReturnValue({ delete: mockSourceDelete });
  mockAddLayer.mockReturnValue({
    delete: mockLayerDelete,
    on: mockLayerOn,
  });

  return {
    addSource: mockAddSource,
    addLayer: mockAddLayer,
  } as unknown as ThreeView;
}

describe("MapLibreStylePlugin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("URL security", () => {
    it("should reject unsafe protocol URLs", async () => {
      const testCases = [
        { url: "file:///etc/passwd", protocol: "file:" },
        { url: "data:text/plain,test", protocol: "data:" },
      ];

      for (const { url, protocol } of testCases) {
        const plugin = new MapLibreStylePlugin(url);
        const view = createMockView();

        await expect(plugin.init(view, mockViewContext)).rejects.toThrow(
          `Unsafe URL protocol "${protocol}"`,
        );
      }
    });

    it("should reject URL-based styles in SSR/Node environments", async () => {
      // Simulate SSR environment by hiding window
      const originalWindow = globalThis.window;
      // @ts-expect-error - Simulating SSR environment
      delete globalThis.window;

      const plugin = new MapLibreStylePlugin("https://example.com/style.json");
      const view = createMockView();

      await expect(plugin.init(view, mockViewContext)).rejects.toThrow(
        /server-side.*SSRF/i,
      );

      // Restore window
      globalThis.window = originalWindow;
    });
  });

  describe("Sources", () => {
    it("should create GeoJSON sources with inline data or URL", async () => {
      const testCases = [
        {
          name: "inline",
          source: {
            type: "geojson" as const,
            data: { type: "FeatureCollection" as const, features: [] },
          },
          expected: {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          },
        },
        {
          name: "url",
          source: {
            type: "geojson" as const,
            data: "https://example.com/data.geojson",
          },
          expected: {
            type: "geojson",
            url: "https://example.com/data.geojson",
          },
        },
      ];

      for (const { source, expected } of testCases) {
        vi.clearAllMocks();
        const style: StyleSpecification = {
          version: 8,
          sources: { test: source },
          layers: [],
        };

        const plugin = new MapLibreStylePlugin(style);
        const view = createMockView();
        await plugin.init(view, mockViewContext);

        expect(mockAddSource).toHaveBeenCalledWith(expected);
      }
    });

    it("should warn and skip raster sources without tiles array", async () => {
      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});
      const style: StyleSpecification = {
        version: 8,
        sources: {
          test: {
            type: "raster",
            url: "https://example.com/tiles.json", // TileJSON not supported
          },
        },
        layers: [],
      };

      const plugin = new MapLibreStylePlugin(style);
      await plugin.init(createMockView(), mockViewContext);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("missing tiles array"),
      );
      expect(mockAddSource).not.toHaveBeenCalled();
      consoleWarnSpy.mockRestore();
    });

    it("should create raster source with tiles array", async () => {
      const style: StyleSpecification = {
        version: 8,
        sources: {
          test: {
            type: "raster",
            tiles: ["https://example.com/tiles/{z}/{x}/{y}.png"],
          },
        },
        layers: [],
      };

      const plugin = new MapLibreStylePlugin(style);
      await plugin.init(createMockView(), mockViewContext);

      expect(mockAddSource).toHaveBeenCalledWith({
        type: "raster-tile",
        url: "https://example.com/tiles/{z}/{x}/{y}.png",
      });
    });

    it("should create raster-dem with supported encodings", async () => {
      const encodings = [
        { encoding: "terrarium" as const, decoder: { type: "terrarium" } },
        { encoding: "mapbox" as const, decoder: { type: "mapbox" } },
        { encoding: "gsi" as const, decoder: { type: "gsi" } },
      ];

      for (const { encoding, decoder } of encodings) {
        vi.clearAllMocks();
        const style = {
          version: 8,
          sources: {
            test: {
              type: "raster-dem" as const,
              tiles: ["https://example.com/dem/{z}/{x}/{y}.png"],
              encoding,
            },
          },
          layers: [],
        } as StyleSpecification;

        const plugin = new MapLibreStylePlugin(style);
        await plugin.init(createMockView(), mockViewContext);

        expect(mockAddSource).toHaveBeenCalledWith({
          type: "raster-dem",
          url: "https://example.com/dem/{z}/{x}/{y}.png",
          elevationDecoder: decoder,
        });
      }
    });

    it("should default to mapbox encoding for raster-dem", async () => {
      const style: StyleSpecification = {
        version: 8,
        sources: {
          test: {
            type: "raster-dem",
            tiles: ["https://example.com/dem/{z}/{x}/{y}.png"],
          },
        },
        layers: [],
      };

      const plugin = new MapLibreStylePlugin(style);
      await plugin.init(createMockView(), mockViewContext);

      expect(mockAddSource).toHaveBeenCalledWith(
        expect.objectContaining({
          elevationDecoder: { type: "mapbox" },
        }),
      );
    });

    it("should warn and skip raster-dem with invalid encoding or missing tiles", async () => {
      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});
      const testCases = [
        {
          name: "no tiles",
          source: {
            type: "raster-dem" as const,
            encoding: "terrarium" as const,
          },
          warning: "missing tiles array",
        },
        {
          name: "custom encoding",
          source: {
            type: "raster-dem" as const,
            tiles: ["https://example.com/dem/{z}/{x}/{y}.png"],
            encoding: "custom" as const,
          },
          warning: 'encoding="custom"',
        },
      ];

      for (const { source, warning } of testCases) {
        vi.clearAllMocks();
        consoleWarnSpy.mockClear();

        const style = {
          version: 8,
          sources: { test: source },
          layers: [],
        } as StyleSpecification;

        const plugin = new MapLibreStylePlugin(style);
        await plugin.init(createMockView(), mockViewContext);

        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining(warning),
        );
        expect(mockAddSource).not.toHaveBeenCalled();
      }

      consoleWarnSpy.mockRestore();
    });

    it("should warn and skip vector sources without tiles array", async () => {
      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});
      const style: StyleSpecification = {
        version: 8,
        sources: {
          test: {
            type: "vector",
            url: "https://example.com/tiles.json",
          },
        },
        layers: [],
      };

      const plugin = new MapLibreStylePlugin(style);
      await plugin.init(createMockView(), mockViewContext);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("missing tiles array"),
      );
      expect(mockAddSource).not.toHaveBeenCalled();
      consoleWarnSpy.mockRestore();
    });

    it("should create vector source with tiles array", async () => {
      const style: StyleSpecification = {
        version: 8,
        sources: {
          test: {
            type: "vector",
            tiles: ["https://example.com/tiles/{z}/{x}/{y}.pbf"],
          },
        },
        layers: [],
      };

      const plugin = new MapLibreStylePlugin(style);
      await plugin.init(createMockView(), mockViewContext);

      expect(mockAddSource).toHaveBeenCalledWith({
        type: "vector-tile",
        url: "https://example.com/tiles/{z}/{x}/{y}.pbf",
      });
    });

    it("should warn and skip unsupported source types", async () => {
      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});
      const style: StyleSpecification = {
        version: 8,
        sources: {
          test: {
            type: "image",
            url: "https://example.com/image.png",
            coordinates: [
              [-180, 85],
              [180, 85],
              [180, -85],
              [-180, -85],
            ],
          },
        },
        layers: [],
      };

      const plugin = new MapLibreStylePlugin(style);
      await plugin.init(createMockView(), mockViewContext);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Unsupported source type: image",
      );
      expect(mockAddSource).not.toHaveBeenCalled();
      consoleWarnSpy.mockRestore();
    });
  });

  describe("Hillshade layers", () => {
    it("should apply valid hillshade exaggeration", async () => {
      const style: StyleSpecification = {
        version: 8,
        sources: {
          dem: {
            type: "raster-dem",
            tiles: ["https://example.com/dem/{z}/{x}/{y}.png"],
            encoding: "terrarium",
          },
        },
        layers: [
          {
            id: "hillshade",
            type: "hillshade",
            source: "dem",
            paint: { "hillshade-exaggeration": 2.0 },
          },
        ],
      };

      const plugin = new MapLibreStylePlugin(style);
      await plugin.init(createMockView(), mockViewContext);

      expect(mockAddLayer).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "raster",
          hillshade: expect.objectContaining({ exaggeration: 2.0 }),
        }),
      );
    });

    it("should fall back to spec default (0.5) for invalid exaggeration", async () => {
      const testCases = [
        {
          layer: {
            id: "hillshade",
            type: "hillshade",
            source: "dem",
            paint: { "hillshade-exaggeration": ["get", "nonexistent"] },
          } as LayerSpecification,
          name: "evaluator fails",
        },
        {
          layer: {
            id: "hillshade",
            type: "hillshade",
            source: "dem",
            paint: { "hillshade-exaggeration": ["/", 1, 0] },
          } as LayerSpecification,
          name: "NaN/Infinity",
        },
        {
          layer: {
            id: "hillshade",
            type: "hillshade",
            source: "dem",
          } as LayerSpecification,
          name: "not specified",
        },
      ];

      for (const { layer } of testCases) {
        vi.clearAllMocks();
        const style: StyleSpecification = {
          version: 8,
          sources: {
            dem: {
              type: "raster-dem",
              tiles: ["https://example.com/dem/{z}/{x}/{y}.png"],
              encoding: "terrarium",
            },
          },
          layers: [layer],
        };

        const plugin = new MapLibreStylePlugin(style);
        await plugin.init(createMockView(), mockViewContext);

        expect(mockAddLayer).toHaveBeenCalledWith(
          expect.objectContaining({
            hillshade: expect.objectContaining({ exaggeration: 0.5 }),
          }),
        );
      }
    });
  });

  describe("Feature geometry type mapping", () => {
    it.each([
      { layerType: "fill" as const, geometryType: "Polygon" },
      { layerType: "fill-extrusion" as const, geometryType: "Polygon" },
      { layerType: "line" as const, geometryType: "LineString" },
      { layerType: "circle" as const, geometryType: "Point" },
      { layerType: "symbol" as const, geometryType: "Point" },
    ])(
      "should use $geometryType for $layerType layers",
      async ({ layerType, geometryType }) => {
        const mockEngine = {
          parseStyle: vi.fn(async (style) => style),
          createFilter: vi.fn(() => () => true),
          createValueFn: vi.fn(() => () => undefined),
          getPaintSpec: vi.fn(() => ({ type: "color", default: "#000000" })),
          getLayoutSpec: vi.fn(() => ({ type: "string", default: "" })),
        } as unknown as StyleEngine;

        const layer: LayerSpecification = {
          id: "test",
          type: layerType,
          source: "test-source",
          filter: ["==", ["geometry-type"], geometryType],
          ...(layerType === "symbol"
            ? { layout: { "icon-image": "marker" } }
            : {}),
        } as LayerSpecification;

        const style: StyleSpecification = {
          version: 8,
          sources: {
            "test-source": {
              type: "geojson",
              data: { type: "FeatureCollection", features: [] },
            },
          },
          layers: [layer],
        };

        const plugin = new MapLibreStylePlugin(style, mockEngine);
        await plugin.init(createMockView(), mockViewContext);

        expect(mockEngine.createFilter).toHaveBeenCalledWith(
          ["==", ["geometry-type"], geometryType],
          layerType,
          geometryType,
        );
      },
    );
  });

  describe("Terrain", () => {
    it("should create terrain with valid source reference", async () => {
      const style: StyleSpecification = {
        version: 8,
        sources: {
          terrain: {
            type: "raster-dem",
            tiles: ["https://example.com/dem/{z}/{x}/{y}.png"],
            encoding: "terrarium",
          },
        },
        layers: [],
        terrain: { source: "terrain", exaggeration: 1.5 },
      };

      const plugin = new MapLibreStylePlugin(style);
      await plugin.init(createMockView(), mockViewContext);

      expect(mockAddLayer).toHaveBeenCalledWith({
        type: "terrain",
        source: { delete: mockSourceDelete },
        terrain: {
          castShadow: true,
          receiveShadow: true,
        },
      });
    });

    it("should log error when terrain source is missing", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const style: StyleSpecification = {
        version: 8,
        sources: {},
        layers: [],
        terrain: { source: "missing" },
      };

      const plugin = new MapLibreStylePlugin(style);
      await plugin.init(createMockView(), mockViewContext);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to add terrain:",
        expect.any(Error),
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe("Error handling", () => {
    it("should log error and continue when source creation fails", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const mockError = new Error("Source creation failed");
      mockAddSource.mockImplementationOnce(() => {
        throw mockError;
      });

      const style: StyleSpecification = {
        version: 8,
        sources: {
          failing: {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          },
        },
        layers: [],
      };

      const plugin = new MapLibreStylePlugin(style);
      await plugin.init(createMockView(), mockViewContext);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to add source "failing":',
        mockError,
      );
      consoleErrorSpy.mockRestore();
    });

    it("should log error and continue when layer creation fails", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const mockError = new Error("Layer creation failed");
      mockAddLayer.mockImplementationOnce(() => {
        throw mockError;
      });

      const style: StyleSpecification = {
        version: 8,
        sources: {
          test: {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          },
        },
        layers: [
          {
            id: "failing",
            type: "fill",
            source: "test",
          },
        ],
      };

      const plugin = new MapLibreStylePlugin(style);
      await plugin.init(createMockView(), mockViewContext);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to add layer "failing":',
        mockError,
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe("Unsupported and misconfigured layers", () => {
    it("should skip unsupported layers without source and continue", async () => {
      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});
      const style: StyleSpecification = {
        version: 8,
        sources: {
          test: {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          },
        },
        layers: [
          { id: "valid", type: "fill", source: "test" },
          {
            id: "background",
            type: "background",
            paint: { "background-color": "#ffffff" },
          } as LayerSpecification,
          { id: "another-valid", type: "line", source: "test" },
        ],
      };

      const plugin = new MapLibreStylePlugin(style);
      await plugin.init(createMockView(), mockViewContext);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Unsupported layer type "background" (no source)',
        ),
      );
      expect(mockAddLayer).toHaveBeenCalledTimes(2);
      consoleWarnSpy.mockRestore();
    });

    it("should reject style when supported layer type has no source", async () => {
      const style: StyleSpecification = {
        version: 8,
        sources: {
          test: {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          },
        },
        layers: [{ id: "no-source", type: "fill" } as LayerSpecification],
      };

      const plugin = new MapLibreStylePlugin(style);
      await expect(
        plugin.init(createMockView(), mockViewContext),
      ).rejects.toThrow(/source/i);
    });

    it("should skip misconfigured symbol layers and continue", async () => {
      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});
      const style: StyleSpecification = {
        version: 8,
        sources: {
          test: {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          },
        },
        layers: [
          { id: "valid", type: "fill", source: "test" },
          { id: "broken-symbol", type: "symbol", source: "test" }, // No icon-image or text-field
          { id: "another-valid", type: "circle", source: "test" },
        ],
      };

      const plugin = new MapLibreStylePlugin(style);
      await plugin.init(createMockView(), mockViewContext);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("no icon-image or text-field"),
      );
      expect(mockAddLayer).toHaveBeenCalledTimes(2);
      consoleWarnSpy.mockRestore();
    });
  });
});
