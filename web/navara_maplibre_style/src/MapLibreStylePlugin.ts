/**
 * MapLibreStylePlugin - Bridge between MapLibre Style JSON and Navara's imperative API.
 *
 * This plugin translates declarative MapLibre Style specifications into Navara layer
 * operations and feature evaluators.
 */

import { Plugin } from "@navara/core";
import ThreeView, {
  type ViewContext,
  type Layer,
  type FeatureEvaluator,
  type FeatureInfo,
} from "@navara/three";

import {
  createPaintEvaluators,
  toEvaluatedValue,
} from "./adapters/toEvaluatedValue";
import { toLayerDescription } from "./adapters/toLayerDescription";
// import { JsStyleEngine } from "./engine/JsStyleEngine";
import { RustStyleEngine } from "./engine/RustStyleEngine";
import type { StyleEngine } from "./engine/StyleEngine";
import type { ParsedStyle, StyleLayer } from "./engine/types";

export class MapLibreStylePlugin extends Plugin<ThreeView, ViewContext> {
  private layers: Layer[] = [];
  private parsedStyle: ParsedStyle | null = null;

  /**
   * Create a new MapLibre Style plugin.
   *
   * @param style - MapLibre Style JSON specification
   * @param engine - Style engine implementation (defaults to RustStyleEngine)
   */
  constructor(
    private readonly style: unknown,
    // private readonly engine: StyleEngine = new JsStyleEngine(),
    private readonly engine: StyleEngine = new RustStyleEngine(),
  ) {
    super();
  }

  async init(view: ThreeView, _ctx: ViewContext): Promise<void> {
    // Parse and validate the style
    this.parsedStyle = await this.engine.parseStyle(this.style);

    // Process each layer in the style
    for (const styleLayer of this.parsedStyle.layers) {
      this.addStyleLayer(view, styleLayer);
    }
  }

  /**
   * Add a MapLibre Style layer to the Navara view.
   */
  private addStyleLayer(view: ThreeView, styleLayer: StyleLayer): void {
    if (!this.parsedStyle) {
      throw new Error("Style not parsed yet");
    }

    // Only support fill layers for this PoC; other types can be added later
    if (styleLayer.type !== "fill") {
      console.warn(`Unsupported layer type: ${styleLayer.type}, skipping`);
      return;
    }

    try {
      // Convert MapLibre layer to Navara LayerDescription
      const layerDesc = toLayerDescription(styleLayer, this.parsedStyle);

      // Add the layer to the view
      const layer = view.addLayer(layerDesc);
      this.layers.push(layer);

      // Set up feature evaluation
      this.setupFeatureEvaluation(layer, styleLayer);
    } catch (err) {
      console.error(`Failed to add layer ${styleLayer.id}:`, err);
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
    // Determine geometry type from layer type
    const geometryType =
      styleLayer.type === "fill"
        ? "Polygon"
        : styleLayer.type === "line"
          ? "LineString"
          : "Point";

    // Create filter function
    const filterFn = styleLayer.filter
      ? this.engine.createFilter(
          styleLayer.filter,
          styleLayer.type,
          geometryType,
        )
      : () => true;

    // Create paint property evaluators
    const paintEvaluators = createPaintEvaluators(
      styleLayer,
      this.engine,
      geometryType,
    );

    // Shared evaluation function for both featureCreated and featureUpdated
    const evaluateFeature = ({
      evaluator,
    }: {
      evaluator: FeatureEvaluator;
    }) => {
      evaluator.evaluate(({ properties }: FeatureInfo) => {
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

        // Convert to Navara's EvaluatedValue format
        return toEvaluatedValue(styleLayer, paintValues);
      });
    };

    // Register for both featureCreated and featureUpdated events
    // featureCreated: handles newly created features as they load
    // featureUpdated: handles updates to existing features (e.g., property changes)
    layer.on("featureCreated", evaluateFeature);
    layer.on("featureUpdated", evaluateFeature);
  }

  /**
   * Get all layers created by this plugin.
   */
  getLayers(): Layer[] {
    return [...this.layers];
  }

  /**
   * Clean up resources.
   */
  dispose(): void {
    // Delete all layers
    for (const layer of this.layers) {
      layer.delete();
    }
    this.layers = [];
    this.parsedStyle = null;
  }
}
