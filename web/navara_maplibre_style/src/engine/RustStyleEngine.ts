/**
 * Rust/WASM implementation of StyleEngine using maplibre-expr.
 *
 * This implementation moves expression evaluation from JavaScript to Rust,
 * providing better performance and type safety through the maplibre-expr crate.
 */

import { CompiledExpression, CompiledFilter } from "@navara/engine";

import type { StyleEngine } from "./StyleEngine";
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
    // TODO: Implement style validation in WASM
    // For MVP: basic checks in TypeScript, full validation later
    if (!raw || typeof raw !== "object") {
      throw new Error("Invalid style: must be an object");
    }
    const style = raw as Record<string, unknown>;
    if (style.version !== 8) {
      throw new Error("Invalid style: version must be 8");
    }
    if (!style.sources || typeof style.sources !== "object") {
      throw new Error("Invalid style: missing sources");
    }
    if (!Array.isArray(style.layers)) {
      throw new Error("Invalid style: missing layers");
    }
    return raw as ParsedStyle;
  }

  createFilter(
    expr: FilterExpression,
    _layerType: LayerType,
    _geometryType: string,
  ): (feature: FeatureContext) => boolean {
    // Match JsStyleEngine behavior: empty filter array means "no filter".
    if (Array.isArray(expr) && expr.length === 0) {
      return () => true;
    }
    // Compile filter in WASM
    const compiled = new CompiledFilter(expr);

    // Return evaluation function
    return (ctx: FeatureContext) => {
      try {
        return compiled.test(
          ctx.properties ?? {},
          0, // TODO: Get actual zoom from camera
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
    _geometryType = "Point",
  ): (ctx: EvaluationContext) => T {
    // Handle constant values directly (optimization)
    if (
      typeof expr === "string" ||
      typeof expr === "number" ||
      typeof expr === "boolean"
    ) {
      const constantValue = this.normalizeConstant(expr, spec) as T;
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
      console.error("Expression compilation error:", e);
      // Return default value on compilation error
      const defaultValue = (spec.default ??
        this.getTypeDefault(spec.type)) as T;
      return () => defaultValue;
    }

    // Return evaluation function
    return (ctx: EvaluationContext) => {
      try {
        const result = compiled.evaluate(
          ctx.properties ?? {},
          0, // navara currently doesn't provide zoom info, so we pass 0 for now
        );

        // Convert maplibre-expr Value to expected StyleValue type
        return this.normalizeValue(result, spec) as T;
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
    // For MVP: Use hardcoded specs matching MapLibre Style Spec
    // Future: Move these definitions to Rust
    const specs: Record<string, Record<string, PropertySpec>> = {
      fill: {
        "fill-color": { type: "color", default: "#000000" },
        "fill-opacity": { type: "number", default: 1, minimum: 0, maximum: 1 },
        "fill-outline-color": { type: "color" },
      },
      line: {
        "line-color": { type: "color", default: "#000000" },
        "line-width": { type: "number", default: 1, minimum: 0 },
        "line-opacity": { type: "number", default: 1, minimum: 0, maximum: 1 },
      },
      circle: {
        "circle-color": { type: "color", default: "#000000" },
        "circle-radius": { type: "number", default: 5, minimum: 0 },
        "circle-opacity": {
          type: "number",
          default: 1,
          minimum: 0,
          maximum: 1,
        },
      },
    };

    return specs[layerType]?.[propertyName];
  }

  // Helper methods

  private normalizeConstant(
    value: string | number | boolean,
    spec: PropertySpec,
  ): StyleValue {
    if (spec.type === "color" && typeof value === "string") {
      return value.startsWith("#") ? this.parseColor(value) : value;
    }
    return value as StyleValue;
  }

  private normalizeValue(value: unknown, spec: PropertySpec): StyleValue {
    // Handle null/undefined by returning default value
    if (value === null || value === undefined) {
      return (spec.default ?? this.getTypeDefault(spec.type)) as StyleValue;
    }

    // Handle color objects from maplibre-expr: { r, g, b, a }
    if (spec.type === "color" && this.isValidMapLibreColor(value)) {
      return value as StyleValue;
    }

    // Handle color strings
    if (spec.type === "color" && typeof value === "string") {
      return value.startsWith("#") ? this.parseColor(value) : value;
    }

    // Numbers, strings, booleans pass through
    return value as StyleValue;
  }

  private isValidMapLibreColor(value: unknown): boolean {
    if (!value || typeof value !== "object") {
      return false;
    }
    const obj = value as Record<string, unknown>;
    return (
      typeof obj.r === "number" &&
      typeof obj.g === "number" &&
      typeof obj.b === "number" &&
      typeof obj.a === "number" &&
      Number.isFinite(obj.r) &&
      Number.isFinite(obj.g) &&
      Number.isFinite(obj.b) &&
      Number.isFinite(obj.a)
    );
  }

  private parseColor(colorStr: string): {
    r: number;
    g: number;
    b: number;
    a: number;
  } {
    // Parse hex color (#RRGGBB or #RRGGBBAA)
    // Return MapLibreColor object format to match JsStyleEngine
    if (colorStr.startsWith("#")) {
      const hex = colorStr.slice(1);
      if (hex.length === 6) {
        return {
          r: parseInt(hex.slice(0, 2), 16) / 255,
          g: parseInt(hex.slice(2, 4), 16) / 255,
          b: parseInt(hex.slice(4, 6), 16) / 255,
          a: 1.0,
        };
      } else if (hex.length === 8) {
        return {
          r: parseInt(hex.slice(0, 2), 16) / 255,
          g: parseInt(hex.slice(2, 4), 16) / 255,
          b: parseInt(hex.slice(4, 6), 16) / 255,
          a: parseInt(hex.slice(6, 8), 16) / 255,
        };
      }
    }

    // Fallback to black
    console.warn(`Unsupported color format: ${colorStr}`);
    return { r: 0, g: 0, b: 0, a: 1.0 };
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
