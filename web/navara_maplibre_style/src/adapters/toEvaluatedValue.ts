/**
 * Converts MapLibre Style paint properties to Navara EvaluatedValue.
 */

import { Color } from "@navara/three";

import type { StyleEngine } from "../engine/StyleEngine";
import {
  isMapLibreColor,
  type EvaluationContext,
  type StyleLayer,
} from "../engine/types";

/**
 * Convert MapLibre color value to Navara Color and extract alpha.
 *
 * Returns object { color, alpha } where:
 * - For MapLibreColor objects: alpha is extracted from the `a` field (or defaults to 1.0)
 * - For CSS color strings: alpha is always 1.0 (alpha from rgba/hsla/#RRGGBBAA is NOT parsed)
 */
function toNavaraColor(
  value: unknown,
): { color: Color; alpha: number } | undefined {
  try {
    if (typeof value === "string") {
      // CSS color string from spec.default fallback (e.g., "#000000", "rgb(255, 0, 0)")
      const color = new Color().setStyle(value);
      // Alpha from rgba/hsla/#RRGGBBAA is not extracted (Three.js Color doesn't store alpha)
      // TODO: Parse alpha from CSS strings like rgba(r,g,b,a) or #RRGGBBAA
      return { color, alpha: 1.0 };
    }
    if (isMapLibreColor(value)) {
      // MapLibre Color object with r, g, b, a values (0-1 range)
      const color = new Color().setRGB(value.r, value.g, value.b);
      const alpha = value.a ?? 1.0;
      return { color, alpha };
    }
  } catch {
    // Ignore invalid color values.
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
      evaluators[key] = engine.createValueFn(expr, spec, geometryType);
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
    opacity?: number;
    show?: boolean;
    // TODO: extrudedHeight, height, size, width, etc. can be added here as needed
  } = {};

  // Map paint properties to Navara properties based on layer type
  if (styleLayer.type === "fill") {
    const colorResult = toNavaraColor(paintValues["fill-color"]);
    if (colorResult) {
      result.color = colorResult.color;
    }
    // Handle opacity independently of color (MapLibre treats them separately)
    const paintOpacity = paintValues["fill-opacity"];
    const colorAlpha = colorResult?.alpha ?? 1.0;
    const opacity =
      typeof paintOpacity === "number" && Number.isFinite(paintOpacity)
        ? paintOpacity
        : undefined;
    if (opacity !== undefined || colorResult) {
      result.opacity =
        opacity !== undefined ? colorAlpha * opacity : colorAlpha;
    }
  } else if (styleLayer.type === "line") {
    const colorResult = toNavaraColor(paintValues["line-color"]);
    if (colorResult) {
      result.color = colorResult.color;
    }
    // Handle opacity independently of color
    const paintOpacity = paintValues["line-opacity"];
    const colorAlpha = colorResult?.alpha ?? 1.0;
    const opacity =
      typeof paintOpacity === "number" && Number.isFinite(paintOpacity)
        ? paintOpacity
        : undefined;
    if (opacity !== undefined || colorResult) {
      result.opacity =
        opacity !== undefined ? colorAlpha * opacity : colorAlpha;
    }
  } else if (styleLayer.type === "circle") {
    const colorResult = toNavaraColor(paintValues["circle-color"]);
    if (colorResult) {
      result.color = colorResult.color;
    }
    // Handle opacity independently of color
    const paintOpacity = paintValues["circle-opacity"];
    const colorAlpha = colorResult?.alpha ?? 1.0;
    const opacity =
      typeof paintOpacity === "number" && Number.isFinite(paintOpacity)
        ? paintOpacity
        : undefined;
    if (opacity !== undefined || colorResult) {
      result.opacity =
        opacity !== undefined ? colorAlpha * opacity : colorAlpha;
    }
  }

  result.show = true;

  return result;
}
