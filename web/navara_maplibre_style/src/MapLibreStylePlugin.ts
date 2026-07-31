/**
 * MapLibreStylePlugin - Bridge between MapLibre Style JSON and Navara's imperative API.
 *
 * This plugin translates declarative MapLibre Style specifications into Navara layer
 * operations and feature evaluators.
 */
import type { StyleSpecification } from "@maplibre/maplibre-gl-style-spec";
import { Plugin } from "@navaramap/core";
import ThreeView, {
  type ViewContext,
  type Layer,
  type Source,
  type FeatureEvaluator,
  type FeatureInfo,
  TERRARIUM_ELEVATION_DECODER,
  MAPBOX_ELEVATION_DECODER,
} from "@navaramap/three";

import {
  createLayoutEvaluators,
  createPaintEvaluators,
  toEvaluatedValue,
} from "./adapters/toEvaluatedValue";
import { toLayerDescription } from "./adapters/toLayerDescription";
import { RustStyleEngine } from "./engine/RustStyleEngine";
import type { StyleEngine } from "./engine/StyleEngine";
import type { ParsedStyle, StyleLayer } from "./engine/types";

export class MapLibreStylePlugin extends Plugin<ThreeView, ViewContext> {
  private sources: Map<string, Source> = new Map<string, Source>();
  private layers: Layer[] = [];
  private parsedStyle: ParsedStyle | null = null;
  /**
   * Track layers that have already warned about invalid geometry types to avoid spamming the console.
   */
  private warnedLayers: Set<string> = new Set<string>();

  /**
   * Create a new MapLibre Style plugin.
   *
   * @param style - MapLibre Style JSON specification
   * @param engine - Style engine implementation (defaults to RustStyleEngine)
   */
  constructor(
    private readonly style: string | StyleSpecification,
    private readonly engine: StyleEngine = new RustStyleEngine(),
  ) {
    super();
  }

  async init(view: ThreeView, _ctx: ViewContext): Promise<void> {
    let styleData: unknown;
    if (typeof this.style === "string") {
      // Fetch style from URL
      try {
        const response = await fetch(this.style);
        if (!response.ok) {
          throw new Error(
            `Failed to fetch style from ${this.style}: ${response.status} ${response.statusText}`,
          );
        }
        styleData = await response.json();
      } catch (err) {
        console.error("Failed to load MapLibre Style from URL:", err);
        throw err;
      }
    } else {
      styleData = this.style;
    }

    try {
      // Parse and validate the style
      this.parsedStyle = await this.engine.parseStyle(styleData);
    } catch (err) {
      console.error("Failed to parse MapLibre style:", err);
      throw err;
    }

    // Step 1: Add all sources first
    for (const [sourceId, sourceSpec] of Object.entries(
      this.parsedStyle.sources,
    )) {
      try {
        this.addStyleSource(view, sourceId, sourceSpec);
      } catch (err) {
        console.error(`Failed to add source "${sourceId}":`, err);
        // Continue loading other sources
      }
    }

    // Step 2: Add layers that reference the sources
    for (const styleLayer of this.parsedStyle.layers) {
      try {
        this.addStyleLayer(view, styleLayer);
      } catch (err) {
        console.error(`Failed to add layer "${styleLayer.id}":`, err);
        // Continue loading other layers
      }
    }

    // Step 3: Add terrain if specified
    if (this.parsedStyle.terrain) {
      try {
        this.addStyleTerrain(view, this.parsedStyle.terrain);
      } catch (err) {
        console.error("Failed to add terrain:", err);
        // Continue without terrain
      }
    }
  }

  /**
   * Extract tile URL template from source spec.
   *
   * In MapLibre Style Spec:
   * - `tiles`: Array of tile URL templates (e.g., "https://example.com/{z}/{x}/{y}.png")
   * - `url`: TileJSON resource URL (e.g., "https://example.com/tiles.json" or "mapbox://...")
   *          that contains metadata including tile URLs, but requires fetching and parsing
   *
   * This method ONLY returns direct tile URL templates from the `tiles` array.
   * Sources with only `url` (TileJSON) are not supported and will return undefined,
   * requiring the caller to skip the source with an appropriate warning.
   *
   * Returns the first tile URL template, or undefined if tiles array is missing/empty.
   */
  private getSourceUrl(sourceSpec: {
    url?: unknown;
    tiles?: unknown;
  }): string | undefined {
    // Only accept direct tile URL templates from tiles array
    if (
      Array.isArray(sourceSpec.tiles) &&
      sourceSpec.tiles.length > 0 &&
      typeof sourceSpec.tiles[0] === "string"
    ) {
      return sourceSpec.tiles[0];
    }

    // Do NOT use url field - it points to TileJSON which needs fetching/parsing
    return undefined;
  }

  /**
   * Add terrain from MapLibre Style specification.
   * Note: Elevation decoder must be configured on the source in advance,
   * as MapLibre Style Spec doesn't include decoder configuration.
   */
  private addStyleTerrain(
    view: ThreeView,
    terrain: ParsedStyle["terrain"],
  ): void {
    if (!terrain) return;

    // Get the terrain source
    const source = this.sources.get(terrain.source);
    if (!source) {
      throw new Error(`Terrain source "${terrain.source}" not found`);
    }

    // Add terrain layer with source reference
    const layer = view.addLayer({
      type: "terrain",
      source,
      terrain: {},
    });
    this.layers.push(layer);
  }

  /**
   * Add a MapLibre Style source to the Navara view.
   */
  private addStyleSource(
    view: ThreeView,
    sourceId: string,
    sourceSpec: ParsedStyle["sources"][string],
  ): void {
    if (sourceSpec.type === "geojson") {
      // Handle both inline GeoJSON data and URL-based sources
      const source =
        typeof sourceSpec.data === "string"
          ? view.addSource({ type: "geojson", url: sourceSpec.data })
          : view.addSource({ type: "geojson", data: sourceSpec.data });
      this.sources.set(sourceId, source);
    } else if (sourceSpec.type === "raster") {
      // Raster tile source (e.g., satellite imagery, basemaps)
      const sourceUrl = this.getSourceUrl(sourceSpec);

      if (sourceUrl) {
        const source = view.addSource({
          type: "raster-tile",
          url: sourceUrl,
        });
        this.sources.set(sourceId, source);
      } else {
        console.warn(
          `Raster source "${sourceId}" missing tiles array (TileJSON "url" field not supported). ` +
            `Add "tiles": ["https://.../{z}/{x}/{y}.png"] to use this source.`,
        );
      }
    } else if (sourceSpec.type === "raster-dem") {
      // Raster DEM source (for terrain/hillshade)
      const sourceUrl = this.getSourceUrl(sourceSpec);

      if (sourceUrl) {
        // Select elevation decoder based on encoding field
        // Supports: terrarium, mapbox
        const encoding = sourceSpec.encoding || "mapbox";
        let elevationDecoder;

        if (encoding === "terrarium") {
          elevationDecoder = TERRARIUM_ELEVATION_DECODER();
        } else if (encoding === "mapbox") {
          elevationDecoder = MAPBOX_ELEVATION_DECODER();
        } else {
          // Unknown or unsupported encoding - warn and skip
          console.warn(
            `Raster-DEM source ${sourceId} has encoding="${encoding}" which is not supported. ` +
              `Supported values: "terrarium", "mapbox". Skipping source.`,
          );
          return;
        }

        const source = view.addSource({
          type: "raster-dem",
          url: sourceUrl,
          elevationDecoder,
        });
        this.sources.set(sourceId, source);
      } else {
        console.warn(
          `Raster-DEM source "${sourceId}" missing tiles array (TileJSON "url" field not supported). ` +
            `Add "tiles": ["https://.../{z}/{x}/{y}.png"] to use this source.`,
        );
      }
    } else if (sourceSpec.type === "vector") {
      // Vector tile source (MVT)
      const sourceUrl = this.getSourceUrl(sourceSpec);

      if (sourceUrl) {
        const source = view.addSource({
          type: "vector-tile",
          url: sourceUrl,
        });
        this.sources.set(sourceId, source);
      } else {
        console.warn(
          `Vector source "${sourceId}" missing tiles array (TileJSON "url" field not supported). ` +
            `Add "tiles": ["https://.../{z}/{x}/{y}.pbf"] to use this source.`,
        );
      }
    } else {
      console.warn(
        `Unsupported source type: ${(sourceSpec as { type: string }).type}`,
      );
    }
  }

  /**
   * Supported layer types that require a source.
   */
  private static readonly SUPPORTED_LAYER_TYPES = new Set([
    "fill",
    "fill-extrusion",
    "line",
    "circle",
    "symbol",
    "raster",
    "hillshade",
  ]);

  /**
   * Add a MapLibre Style layer to the Navara view.
   */
  private addStyleLayer(view: ThreeView, styleLayer: StyleLayer): void {
    if (!this.parsedStyle) {
      throw new Error("Style not parsed yet");
    }

    // Check if layer has a source
    if (!styleLayer.source) {
      // Supported layer types require a source - this is a configuration error
      if (MapLibreStylePlugin.SUPPORTED_LAYER_TYPES.has(styleLayer.type)) {
        throw new Error(
          `Layer "${styleLayer.id}": Layer type "${styleLayer.type}" requires a source`,
        );
      }
      // Unsupported layer types without source (background, sky, fog) - warn and skip
      console.warn(
        `Layer "${styleLayer.id}": Unsupported layer type "${styleLayer.type}" (no source). Skipping layer.`,
      );
      return;
    }

    // Get the source for this layer
    const source = this.sources.get(styleLayer.source);
    if (!source) {
      // Supported layer types with missing source reference - this is a configuration error
      if (MapLibreStylePlugin.SUPPORTED_LAYER_TYPES.has(styleLayer.type)) {
        throw new Error(
          `Layer "${styleLayer.id}": Source "${styleLayer.source}" not found`,
        );
      }
      // Unsupported layer types - warn and skip
      console.warn(
        `Layer "${styleLayer.id}": Unsupported layer type "${styleLayer.type}". Skipping layer.`,
      );
      return;
    }

    // Create layer description
    const layerDesc = toLayerDescription(source, styleLayer);

    // Skip unsupported layers (toLayerDescription returns null for unsupported types)
    if (!layerDesc) {
      return;
    }

    // Add layer
    const layer = view.addLayer(layerDesc);
    this.layers.push(layer);

    // Set up feature evaluation for vector layers
    if (
      styleLayer.type === "fill" ||
      styleLayer.type === "fill-extrusion" ||
      styleLayer.type === "line" ||
      styleLayer.type === "circle" ||
      styleLayer.type === "symbol"
    ) {
      this.setupFeatureEvaluation(layer, styleLayer);
    }
  }

  /**
   * Set up feature evaluation callbacks for a layer.
   * This is where we bridge MapLibre expressions to Navara's evaluator API.
   *
   * TODO: Add zoom support - need to:
   * 1. Listen to camera movement events
   * 2. Detect zoom level changes
   * 3. Call layer.forceUpdate() to trigger re-evaluation
   * 4. Use current view zoom (not tile zoom) in evaluation context
   */
  private setupFeatureEvaluation(layer: Layer, styleLayer: StyleLayer): void {
    // Determine MapLibre feature geometry type for expression evaluation
    // This is the GeoJSON geometry type used in MapLibre expressions (e.g., ["geometry-type"])
    const featureGeometryType =
      styleLayer.type === "fill" || styleLayer.type === "fill-extrusion"
        ? "Polygon"
        : styleLayer.type === "line"
          ? "LineString"
          : "Point";

    // Create filter function
    const filterFn = styleLayer.filter
      ? this.engine.createFilter(
          styleLayer.filter,
          styleLayer.type,
          featureGeometryType,
        )
      : () => true;

    // Create paint property evaluators
    const paintEvaluators = createPaintEvaluators(
      styleLayer,
      this.engine,
      featureGeometryType,
    );

    // Create layout property evaluators (for symbol layers)
    const layoutEvaluators =
      styleLayer.type === "symbol"
        ? createLayoutEvaluators(styleLayer, this.engine, featureGeometryType)
        : {};

    /**
     * Evaluate layout properties for symbol layers based on meshGeometryType.
     * Performance: Only evaluates properties needed for the current rendering mode.
     */
    const evaluateLayoutProperties = (
      ctx: { properties: Record<string, unknown> | undefined },
      meshGeometryType: string | undefined,
    ): Record<string, unknown> | undefined => {
      if (styleLayer.type !== "symbol") {
        return undefined;
      }

      const layoutValues: Record<string, unknown> = {};

      // Icon properties (needed for billboard rendering)
      if (meshGeometryType === "billboard") {
        const iconProps = [
          "icon-image",
          "icon-size",
          "icon-anchor",
          "icon-offset",
        ];
        for (const key of iconProps) {
          const evalFn = layoutEvaluators[key];
          if (evalFn) {
            layoutValues[key] = evalFn(ctx);
          }
        }
      }

      // Text properties (needed for text rendering)
      if (meshGeometryType === "text") {
        const textProps = [
          "text-field",
          "text-size",
          "text-font",
          "text-anchor",
          "text-offset",
        ];
        for (const key of textProps) {
          const evalFn = layoutEvaluators[key];
          if (evalFn) {
            layoutValues[key] = evalFn(ctx);
          }
        }
      }

      // If meshGeometryType is undefined or other value, evaluate all (fallback for safety)
      if (meshGeometryType !== "billboard" && meshGeometryType !== "text") {
        for (const [key, evalFn] of Object.entries(layoutEvaluators)) {
          layoutValues[key] = evalFn(ctx);
        }
      }

      return layoutValues;
    };

    // Shared evaluation function for both featureCreated and featureUpdated
    const evaluateFeature = ({
      evaluator,
    }: {
      evaluator: FeatureEvaluator;
    }) => {
      evaluator.evaluate(
        ({ properties, meshGeomType: meshGeometryType }: FeatureInfo) => {
          const ctx = { properties };

          // Check filter first
          if (!filterFn(ctx)) {
            return { show: false };
          }

          // Evaluate all paint properties
          const paintValues: Record<string, unknown> = {};
          for (const [key, evalFn] of Object.entries(paintEvaluators)) {
            try {
              paintValues[key] = evalFn(ctx);
            } catch (_err) {
              // Ignore evaluation errors for individual paint properties
            }
          }

          // Evaluate layout properties (only for symbol layers)
          const layoutValues = evaluateLayoutProperties(ctx, meshGeometryType);

          // Convert to Navara's EvaluatedValue format
          // meshGeometryType is the Navara mesh type ("billboard" | "text" | "polygon" | ...)
          // used to determine which properties to apply when both icon and text are present
          return toEvaluatedValue(
            styleLayer,
            paintValues,
            layoutValues,
            meshGeometryType,
            this.warnedLayers,
          );
        },
      );
    };

    // Register for both featureCreated and featureUpdated events
    // featureCreated: handles newly created features as they load
    // featureUpdated: handles updates to existing features (e.g., property changes)
    layer.on("featureCreated", evaluateFeature);
    layer.on("featureUpdated", evaluateFeature);
  }

  /**
   * Clean up resources.
   */
  dispose(): void {
    // Delete all layers first (layers reference sources)
    for (const layer of this.layers) {
      layer.delete();
    }
    this.layers = [];

    // Then delete all sources
    for (const source of this.sources.values()) {
      source.delete();
    }
    this.sources.clear();

    // Clear warned layers to prevent memory leaks
    this.warnedLayers.clear();

    this.parsedStyle = null;
  }
}
