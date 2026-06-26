/**
 * StyleEngine interface - the swap point for JS vs Rust implementations.
 *
 * This interface abstracts away the underlying MapLibre Style spec parser,
 * allowing us to start with a JS implementation and later swap to Rust/WASM
 * without changing the plugin code.
 *
 * Design principle: Return plain functions, not MapLibre-specific types.
 */

import type {
  EvaluationContext,
  FeatureContext,
  FilterExpression,
  LayerType,
  ParsedStyle,
  PropertySpec,
  StyleValue,
  ValueExpression,
} from "./types";

export interface StyleEngine {
  /**
   * Validate and normalize Style JSON.
   * In WASM implementations, this may also include async initialization.
   *
   * @param raw - Raw style JSON object
   * @returns Validated and normalized style
   * @throws Error if validation fails
   */
  parseStyle(raw: unknown): Promise<ParsedStyle>;

  /**
   * Turn a filter expression into a boolean predicate function.
   *
   * @param expr - MapLibre filter expression (e.g., ["==", "type", "park"])
   * @param layerType - Layer type for context-specific filtering
   * @param geometryType - Geometry type (Polygon, LineString, Point)
   * @returns Function that evaluates to true/false for each feature
   */
  createFilter(
    expr: FilterExpression,
    layerType: LayerType,
    geometryType: string,
  ): (feature: FeatureContext) => boolean;

  /**
   * Turn a paint/layout expression into a value function.
   * The function takes zoom and feature properties, returns typed value.
   *
   * @param expr - MapLibre expression (e.g., ["get", "height"] or "#ff0000")
   * @param spec - Property specification for type info and defaults
   * @param geometryType - Geometry type (Polygon, LineString, Point)
   * @returns Function that evaluates the expression for a given context
   */
  createValueFn<T extends StyleValue>(
    expr: ValueExpression,
    spec: PropertySpec,
    geometryType?: string,
  ): (ctx: EvaluationContext) => T;

  /**
   * Get the property specification for a paint property.
   * This allows adapters to access paint specs without directly importing
   * from the style-spec library, maintaining the StyleEngine abstraction.
   *
   * @param layerType - Layer type (fill, line, circle)
   * @param propertyName - Paint property name (e.g., "fill-color", "line-width")
   * @returns Property specification with type, default, and constraints, or undefined if not found
   */
  getPaintSpec(
    layerType: LayerType,
    propertyName: string,
  ): PropertySpec | undefined;
}
