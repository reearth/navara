/**
 * Converts MapLibre Style paint properties to Navara EvaluatedValue.
 */

import { Color } from "@navara/three";
import type { EvaluationContext, StyleLayer } from "../engine/types";
import type { StyleEngine } from "../engine/StyleEngine";

/**
 * MapLibre Color object returned from expression evaluation.
 */
interface MapLibreColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

/**
 * Type guard to check if a value is a MapLibre Color object.
 */
function isMapLibreColor(value: unknown): value is MapLibreColor {
  return (
    typeof value === "object" &&
    value !== null &&
    "r" in value &&
    "g" in value &&
    "b" in value &&
    typeof (value as MapLibreColor).r === "number" &&
    typeof (value as MapLibreColor).g === "number" &&
    typeof (value as MapLibreColor).b === "number"
  );
}

/**
 * Convert MapLibre color value to Navara Color.
 * MapLibre's expression evaluator returns Color objects for evaluated expressions,
 * but fallback defaults from spec.default are often CSS strings like "#000000".
 */
function toNavaraColor(value: unknown): Color | undefined {
  if (typeof value === "string") {
    // CSS color string from spec.default fallback (e.g., "#000000", "rgb(255, 0, 0)")
    return new Color().setStyle(value);
  } else if (isMapLibreColor(value)) {
    // MapLibre Color object with r, g, b values (0-1 range)
    return new Color().setRGB(value.r, value.g, value.b);
  }
  return undefined;
}

/**
 * Create evaluator functions for a style layer's paint properties.
 *
 * @param styleLayer - MapLibre layer definition
 * @param engine - Style engine for creating expression evaluators
 * @param geometryType - Geometry type for the layer
 * @returns Object with evaluator functions for each paint property
 */
export function createPaintEvaluators(
  styleLayer: StyleLayer,
  engine: StyleEngine,
  geometryType: string,
) {
  const evaluators: Record<string, (ctx: EvaluationContext) => unknown> = {};

  if (!styleLayer.paint) {
    return evaluators;
  }

  // Create evaluator for each paint property
  for (const [key, value] of Object.entries(styleLayer.paint)) {
    const spec = engine.getPaintSpec(styleLayer.type, key);
    if (!spec) {
      console.warn(`Unknown paint property for ${styleLayer.type}: ${key}`);
      continue;
    }

    // If value is undefined, use default from spec
    const expr = value ?? spec.default;

    try {
      evaluators[key] = engine.createValueFn(expr, spec as any, geometryType);
    } catch (err) {
      console.error(`Failed to create evaluator for ${key}:`, err);
      // Fallback to constant default value
      evaluators[key] = () => spec.default;
    }
  }

  return evaluators;
}

/**
 * Convert evaluated paint values to Navara's EvaluatedValue format.
 *
 * @param styleLayer - MapLibre layer definition
 * @param paintValues - Evaluated paint property values
 * @returns Navara EvaluatedValue object
 */
export function toEvaluatedValue(
  styleLayer: StyleLayer,
  paintValues: Record<string, unknown>,
) {
  const result: {
    color?: Color;
    show?: boolean;
    // Future: extrudedHeight, height, text
  } = {};

  // Map paint properties to Navara properties based on layer type
  if (styleLayer.type === "fill") {
    const color = toNavaraColor(paintValues["fill-color"]);
    if (color) {
      result.color = color;
    }
  } else if (styleLayer.type === "line") {
    const color = toNavaraColor(paintValues["line-color"]);
    if (color) {
      result.color = color;
    }
  } else if (styleLayer.type === "circle") {
    const color = toNavaraColor(paintValues["circle-color"]);
    if (color) {
      result.color = color;
    }
  }

  result.show = true;

  return result;
}
