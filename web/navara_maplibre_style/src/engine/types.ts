/**
 * Core types for MapLibre Style engine abstraction.
 * These types define the interface between the plugin and the style engine,
 * allowing easy swap between JS and future Rust/WASM implementations.
 */

/**
 * Simplified MapLibre Style specification.
 * For the PoC, we only support a subset of the full spec.
 */
export interface ParsedStyle {
  version: 8;
  sources: Record<string, StyleSource>;
  layers: StyleLayer[];
}

/**
 * Style source types we support in the PoC.
 */
export type StyleSource = GeoJSONSource | VectorSource;

export interface GeoJSONSource {
  type: "geojson";
  data: string | GeoJSON.GeoJSON;
  maxzoom?: number;
  buffer?: number;
  tolerance?: number;
}

export interface VectorSource {
  type: "vector";
  url?: string;
  tiles?: string[];
  minzoom?: number;
  maxzoom?: number;
}

/**
 * Layer types supported in PoC: fill, line, circle.
 */
export type StyleLayer = FillLayer | LineLayer | CircleLayer;

export type LayerType = "fill" | "line" | "circle";

export interface BaseLayer {
  id: string;
  type: LayerType;
  source: string;
  "source-layer"?: string;
  minzoom?: number;
  maxzoom?: number;
  filter?: FilterExpression;
  layout?: Record<string, unknown>;
}

export interface FillLayer extends BaseLayer {
  type: "fill";
  paint?: FillPaint;
}

export interface FillPaint {
  "fill-color"?: ValueExpression;
  "fill-opacity"?: ValueExpression;
  "fill-outline-color"?: ValueExpression;
}

export interface LineLayer extends BaseLayer {
  type: "line";
  paint?: LinePaint;
}

export interface LinePaint {
  "line-color"?: ValueExpression;
  "line-width"?: ValueExpression;
  "line-opacity"?: ValueExpression;
}

export interface CircleLayer extends BaseLayer {
  type: "circle";
  paint?: CirclePaint;
}

export interface CirclePaint {
  "circle-color"?: ValueExpression;
  "circle-radius"?: ValueExpression;
  "circle-opacity"?: ValueExpression;
}

/**
 * Expression types from MapLibre Style spec.
 * These can be literals, property references, or complex expressions.
 */
export type ValueExpression = string | number | boolean | unknown[];
export type FilterExpression = unknown[];

/**
 * Context for evaluating style expressions.
 *
 * TODO: Add zoom support - requires camera movement listeners and re-evaluation
 * when zoom changes, since features from different tile zoom levels coexist.
 */
export interface EvaluationContext {
  properties: Record<string, unknown> | undefined;
}

/**
 * Context for filter evaluation (subset of EvaluationContext).
 */
export interface FeatureContext {
  properties: Record<string, unknown> | undefined;
}

/**
 * Possible return types from style expressions.
 */
export type StyleValue =
  | number
  | string
  | boolean
  | [number, number, number, number];

/**
 * Property specification for type checking and defaults.
 * This matches the structure from @maplibre/maplibre-gl-style-spec.
 */
export interface PropertySpec {
  type: "color" | "number" | "boolean" | "string" | "array";
  default?: unknown;
  minimum?: number;
  maximum?: number;
  expression?: {
    interpolated: boolean;
    parameters: string[];
  };
}
