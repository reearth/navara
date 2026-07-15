/**
 * Rust/WASM implementation of StyleEngine using maplibre-expr.
 *
 * This implementation moves expression evaluation from JavaScript to Rust,
 * providing better performance and type safety through the maplibre-expr crate.
 */

import { validateStyleMin } from "@maplibre/maplibre-gl-style-spec";
import type { StyleSpecification } from "@maplibre/maplibre-gl-style-spec";
import { CompiledExpression, CompiledFilter } from "@navara/engine";

import type { StyleEngine } from "./StyleEngine";
import {
  PAINT_SPECS_BY_TYPE,
  type EvaluationContext,
  type FeatureContext,
  type FilterExpression,
  type LayerType,
  type ParsedStyle,
  type PropertySpec,
  type StyleValue,
  type ValueExpression,
} from "./types";

export class RustStyleEngine implements StyleEngine {
  async parseStyle(raw: unknown): Promise<ParsedStyle> {
    const errors = validateStyleMin(raw as StyleSpecification);

    if (errors && errors.length > 0) {
      const errorMessages = errors.map((e: { message: string }) => e.message);
      throw new Error(`Invalid MapLibre Style: ${errorMessages.join(", ")}`);
    }

    return raw as ParsedStyle;
  }

  createFilter(
    expr: FilterExpression,
    _layerType: LayerType,
    geometryType: string,
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
          geometryType, // Pass geometry type for ["geometry-type"] filters
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
    geometryType = "Point",
  ): (ctx: EvaluationContext) => T {
    // Handle constant values directly (optimization)
    if (
      typeof expr === "string" ||
      typeof expr === "number" ||
      typeof expr === "boolean"
    ) {
      const constantValue = expr as T;
      return () => constantValue;
    }

    // MapLibre also allows literal arrays as property values (these are not expression arrays).
    if (
      Array.isArray(expr) &&
      (expr.length === 0 || typeof expr[0] !== "string")
    ) {
      const constantValue = expr as unknown as T;
      return () => constantValue;
    }

    // Compile expression in WASM
    let compiled: CompiledExpression;
    try {
      compiled = new CompiledExpression(expr);
    } catch (e) {
      // Let the caller add property/layer context (and decide the fallback).
      throw e instanceof Error ? e : new Error(String(e));
    }

    // Return evaluation function
    return (ctx: EvaluationContext) => {
      try {
        const result = compiled.evaluate(
          ctx.properties ?? {},
          0, // navara currently doesn't provide zoom info, so we pass 0 for now
          geometryType, // Pass geometry type for expressions that need it
        );

        // Return result as-is; maplibre-expr handles type conversion
        return result as T;
      } catch (e) {
        console.error("Expression evaluation error:", e);
        // Return default on evaluation error
        return (spec.default ?? this.getTypeDefault(spec.type)) as T;
      }
    };
  }

  getPaintSpec(
    layerType: LayerType,
    propertyName: string,
  ): PropertySpec | undefined {
    const paintSpecs = PAINT_SPECS_BY_TYPE[layerType];
    if (!paintSpecs) {
      return undefined;
    }

    const spec = paintSpecs[propertyName as keyof typeof paintSpecs];
    return spec as PropertySpec | undefined;
  }

  private getTypeDefault(type: PropertySpec["type"]): StyleValue {
    switch (type) {
      case "color":
        return { r: 0, g: 0, b: 0, a: 1 }; // Black in MapLibreColor format
      case "number":
        return 0;
      case "boolean":
        return false;
      case "string":
        return "";
      case "array":
        return [];
      default:
        // Safe fallback for unknown types
        return [];
    }
  }
}
