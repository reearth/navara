/**
 * Converts MapLibre Style paint properties to Navara EvaluatedValue.
 */

import { Color } from "@navara/three";
import type { EvaluationContext, StyleLayer } from "../engine/types";
import type { StyleEngine } from "../engine/StyleEngine";

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
    const colorStr = paintValues["fill-color"] as string | undefined;

    if (colorStr) {
      const color = new Color().setStyle(colorStr);
      result.color = color;
    }
  } else if (styleLayer.type === "line") {
    const colorStr = paintValues["line-color"] as string | undefined;

    if (colorStr) {
      result.color = new Color().setStyle(colorStr);
    }
  } else if (styleLayer.type === "circle") {
    const colorStr = paintValues["circle-color"] as string | undefined;

    if (colorStr) {
      result.color = new Color().setStyle(colorStr);
    }
  }

  result.show = true;

  return result;
}
