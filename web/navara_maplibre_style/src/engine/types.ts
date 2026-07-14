/**
 * Core types for MapLibre Style engine abstraction.
 * These types define the interface between the plugin and the style engine,
 * allowing easy swap between JS and future Rust/WASM implementations.
 */

import type { GeoJSON } from "geojson";

/**
 * Simplified MapLibre Style specification.
 * For the PoC, we only support a subset of the full spec.
 */
export type ParsedStyle = {
  version: 8;
  sources: Record<string, StyleSource>;
  layers: StyleLayer[];
};

/**
 * Source types supported in PoC: vector, geojson.
 */
export type StyleSource = VectorSource | GeoJSONSource;

export type GeoJSONSource = {
  type: "geojson";
  data: GeoJSON | string;
};

export type VectorSource = {
  type: "vector";
  url?: string;
  tiles?: string[];
  minzoom?: number;
  maxzoom?: number;
};

/**
 * Layer types supported in PoC: fill, line, circle.
 */
export type StyleLayer = FillLayer | LineLayer | CircleLayer;

export type LayerType = "fill" | "line" | "circle";

export type BaseLayer = {
  id: string;
  type: LayerType;
  source: string;
  "source-layer"?: string;
  minzoom?: number;
  maxzoom?: number;
  filter?: FilterExpression;
  layout?: Record<string, unknown>;
};

export type FillLayer = {
  type: "fill";
  paint?: FillPaint;
} & BaseLayer;

export type FillPaint = {
  "fill-color"?: ValueExpression;
  "fill-opacity"?: ValueExpression;
  "fill-outline-color"?: ValueExpression;
};

export type LineLayer = {
  type: "line";
  paint?: LinePaint;
} & BaseLayer;

export type LinePaint = {
  "line-color"?: ValueExpression;
  "line-width"?: ValueExpression;
  "line-opacity"?: ValueExpression;
};

export type CircleLayer = {
  type: "circle";
  paint?: CirclePaint;
} & BaseLayer;

export type CirclePaint = {
  "circle-color"?: ValueExpression;
  "circle-radius"?: ValueExpression;
  "circle-opacity"?: ValueExpression;
};

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
export type EvaluationContext = {
  properties: Record<string, unknown> | undefined;
};

/**
 * Context for filter evaluation (subset of EvaluationContext).
 */
export type FeatureContext = {
  properties: Record<string, unknown> | undefined;
};

/**
 * MapLibre Color object format (consistent with @maplibre/maplibre-gl-style-spec).
 */
export type MapLibreColor = {
  r: number;
  g: number;
  b: number;
  a: number;
};

/**
 * Possible return types from style expressions.
 *
 * Common array-valued properties in MapLibre Style Spec:
 * - line-dasharray: number[]
 * - text-offset: [number, number]
 * - icon-offset: [number, number]
 * - translate: [number, number]
 */
export type StyleValue =
  | number
  | string
  | boolean
  | MapLibreColor
  | [number, number, number, number] // Legacy color array format
  | number[] // Array-valued properties (dasharray, offset, translate, etc.)
  | [number, number]; // Two-element numeric arrays (offset, translate)

/**
 * Property specification for type checking and defaults.
 * This matches the structure from @maplibre/maplibre-gl-style-spec.
 */
export type PropertySpec = {
  type: "color" | "number" | "boolean" | "string" | "array";
  default?: unknown;
  minimum?: number;
  maximum?: number;
  expression?: {
    interpolated: boolean;
    parameters: string[];
  };
};
