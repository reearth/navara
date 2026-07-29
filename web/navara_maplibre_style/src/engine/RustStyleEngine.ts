/**
 * Rust/WASM implementation of StyleEngine using maplibre-expr.
 *
 * This implementation moves expression evaluation from JavaScript to Rust,
 * providing better performance and type safety through the maplibre-expr crate.
 */

import { validateStyleMin } from "@maplibre/maplibre-gl-style-spec";
import type { StyleSpecification } from "@maplibre/maplibre-gl-style-spec";
import { CompiledExpression, CompiledFilter } from "@navaramap/engine";

import type { StyleEngine } from "./StyleEngine";
import {
  filterNavaraExtensionErrors,
  getLayoutSpec,
  getPaintSpec,
  getTypeDefault,
  isLiteralArray,
} from "./styleEngineUtils";
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

export class RustStyleEngine implements StyleEngine {
  async parseStyle(raw: unknown): Promise<ParsedStyle> {
    const errors = validateStyleMin(raw as StyleSpecification);

    if (errors && errors.length > 0) {
      // Filter out errors related to Navara extensions and relaxed validation
      const relevantErrors = filterNavaraExtensionErrors(errors);

      if (relevantErrors.length > 0) {
        const errorMessages = relevantErrors.map(
          (e: { message: string }) => e.message,
        );
        throw new Error(`Invalid MapLibre Style: ${errorMessages.join(", ")}`);
      }
    }

    return raw as ParsedStyle;
  }

  createFilter(
    expr: FilterExpression,
    _layerType: LayerType,
    featureGeometryType: string,
  ): (feature: FeatureContext) => boolean {
    // Match JsStyleEngine behavior: empty filter array means "no filter".
    if (Array.isArray(expr) && expr.length === 0) {
      return () => true;
    }
    // Compile filter in WASM
    let compiled: CompiledFilter;
    try {
      compiled = new CompiledFilter(expr);
    } catch (e) {
      console.error("Filter compilation error:", e);
      return () => false; // Hide features when filter can't be compiled
    }

    // Return evaluation function
    return (ctx: FeatureContext) => {
      try {
        return compiled.test(
          ctx.properties ?? {},
          0, // TODO: Get actual zoom from camera
          featureGeometryType, // Pass geometry type for ["geometry-type"] filters
        );
      } catch (e) {
        console.error("Filter evaluation error:", e);
        return false; // Default to hiding features on error
      }
    };
  }

  createValueFn<T extends StyleValue>(
    expr: ValueExpression,
    spec: PropertySpec,
    featureGeometryType = "Point",
  ): (ctx: EvaluationContext) => T {
    // Handle constant values directly (optimization).
    // For color strings, still compile via WASM so maplibre-expr can validate/coerce (and preserve alpha).
    if (typeof expr === "number" || typeof expr === "boolean") {
      const constantValue = expr as T;
      return () => constantValue;
    }
    if (typeof expr === "string" && spec.type !== "color") {
      const constantValue = expr as T;
      return () => constantValue;
    }

    // MapLibre allows literal arrays as property values (e.g., [1, 2, 3]).
    // Only treat as constant if it's empty or doesn't start with a string operator.
    if (
      Array.isArray(expr) &&
      (expr.length === 0 || typeof expr[0] !== "string")
    ) {
      const constantValue = expr as unknown as T;
      return () => constantValue;
    }

    // Compile expression in WASM with type checking
    let compiled: CompiledExpression;
    let requiredProps: string[] | null = null;
    try {
      // Pass expected type for validation (matches JsStyleEngine behavior)
      compiled = new CompiledExpression(expr, spec.type);

      // Extract required properties for optimization
      const propsArray = compiled.getRequiredProperties();
      requiredProps = Array.from(propsArray) as string[];
    } catch (e) {
      // If compilation fails and this looks like a literal array (paths, font names, etc.),
      // treat it as a constant value instead of throwing.
      // This handles cases like text-font: ["/fonts/custom.ttf"] or ["Font Name"] which are valid literals.
      if (isLiteralArray(expr)) {
        const constantValue = expr as unknown as T;
        return () => constantValue;
      }

      // Let the caller add property/layer context (and decide the fallback).
      throw e instanceof Error ? e : new Error(String(e));
    }

    // Return evaluation function with optimized property passing
    return (ctx: EvaluationContext) => {
      try {
        // Filter properties to only required ones to reduce serialization overhead
        let propsToPass: Record<string, unknown>;
        if (requiredProps === null || requiredProps.length === 0) {
          // Empty array means dynamic property access (e.g., ["get", ["concat", ...]])
          // since constants are already filtered out above.
          // Conservative approach: pass all properties to avoid breaking evaluation.
          propsToPass = ctx.properties ?? {};
        } else {
          // Only pass required properties
          propsToPass = {};
          if (ctx.properties) {
            for (const prop of requiredProps) {
              if (Object.prototype.hasOwnProperty.call(ctx.properties, prop)) {
                propsToPass[prop] = ctx.properties[prop];
              }
            }
          }
        }

        const result = compiled.evaluate(
          propsToPass,
          0, // navara currently doesn't provide zoom info, so we pass 0 for now
          featureGeometryType, // Pass geometry type for expressions that need it
        );

        if (result == null) {
          return (spec.default ?? getTypeDefault(spec.type)) as T;
        }

        // Return result as-is; maplibre-expr handles type conversion
        return result as T;
      } catch (e) {
        console.error("Expression evaluation error:", e);
        // Return default on evaluation error
        return (spec.default ?? getTypeDefault(spec.type)) as T;
      }
    };
  }

  getPaintSpec(
    layerType: LayerType,
    propertyName: string,
  ): PropertySpec | undefined {
    return getPaintSpec(layerType, propertyName);
  }

  getLayoutSpec(
    layerType: LayerType,
    propertyName: string,
  ): PropertySpec | undefined {
    return getLayoutSpec(layerType, propertyName);
  }
}
