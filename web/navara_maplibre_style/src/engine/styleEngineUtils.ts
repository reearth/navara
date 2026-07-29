/**
 * Shared utilities for StyleEngine implementations.
 */

import { LAYOUT_SPECS_BY_TYPE } from "./layoutSpecs";
import { PAINT_SPECS_BY_TYPE } from "./paintSpecs";
import type { LayerType, PropertySpec, StyleValue } from "./types";

/**
 * Filter validation errors to ignore Navara-specific extensions.
 *
 * Navara extends the MapLibre Style Spec with:
 * - "gsi" encoding for raster-dem sources (Japanese GSI terrain tiles)
 * - Relaxed hillshade-exaggeration range (allows > 1.0 for artistic effects)
 * - Data expressions for hillshade properties (even if spec doesn't officially support)
 */
export function filterNavaraExtensionErrors(
  errors: { message: string }[],
): { message: string }[] {
  return errors.filter((e) => {
    const msg = e.message.toLowerCase();

    // Skip validation errors for raster-dem sources with "gsi" encoding (Navara extension)
    if (msg.includes("encoding") && msg.includes("gsi")) {
      return false;
    }

    // Skip hillshade-exaggeration range validation
    // MapLibre spec restricts to 0-1, but we allow higher values for artistic effects
    if (
      msg.includes("hillshade-exaggeration") &&
      (msg.includes("greater than") || msg.includes("maximum"))
    ) {
      return false;
    }

    // Skip data expression restrictions for hillshade properties
    // We want to support expressions even if MapLibre spec doesn't officially support them
    if (msg.includes("hillshade") && msg.includes("data expressions")) {
      return false;
    }

    return true;
  });
}

/**
 * Get paint property spec for a layer type.
 */
export function getPaintSpec(
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

/**
 * Get layout property spec for a layer type.
 */
export function getLayoutSpec(
  layerType: LayerType,
  propertyName: string,
): PropertySpec | undefined {
  const layoutSpecs = LAYOUT_SPECS_BY_TYPE[layerType];
  if (!layoutSpecs) {
    return undefined;
  }

  const spec = layoutSpecs[propertyName as keyof typeof layoutSpecs];
  return spec as PropertySpec | undefined;
}

/**
 * Get default value for a property type.
 * Used as fallback when spec.default is undefined or evaluation fails.
 */
export function getTypeDefault(type: PropertySpec["type"]): StyleValue {
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

/**
 * Check if an array expression looks like a literal value rather than an expression.
 *
 * Literal arrays include:
 * - Font paths: ["/fonts/custom.ttf"]
 * - Font names with spaces: ["Open Sans Regular"]
 * - Font names starting with uppercase: ["Roboto"]
 *
 * Expression arrays have lowercase operators as first element: ["get", "prop"]
 */
export function isLiteralArray(expr: unknown): boolean {
  if (!Array.isArray(expr) || expr.length === 0) {
    return false;
  }

  const firstElement = expr[0];
  if (typeof firstElement !== "string") {
    return false;
  }

  // Check if it looks like a literal value rather than an expression operator:
  // - Starts with "/" (path)
  // - Contains spaces (font names like "Open Sans Regular")
  // - Starts with uppercase (font names)
  // But NOT if it's a known expression operator (they're lowercase, no spaces, no slashes)
  return (
    firstElement.startsWith("/") ||
    firstElement.includes(" ") ||
    /^[A-Z]/.test(firstElement)
  );
}
