/**
 * Converts MapLibre Style layer to Navara layer description.
 */

import type { LayerDescription, Source } from "@navaramap/three";

import type { StyleLayer } from "../engine/types";

/**
 * Create layer description for fill layer.
 */
function createFillLayer(source: Source): LayerDescription {
  return {
    type: "vector",
    source,
    polygon: {
      clampToGround: true,
    },
  };
}

/**
 * Create layer description for fill-extrusion layer.
 */
function createFillExtrusionLayer(source: Source): LayerDescription {
  return {
    type: "vector",
    source,
    polygon: {
      clampToGround: false,
    },
  };
}

/**
 * Create layer description for line layer.
 */
function createLineLayer(source: Source): LayerDescription {
  return {
    type: "vector",
    source,
    polyline: {
      clampToGround: true,
    },
  };
}

/**
 * Create layer description for circle layer.
 */
function createCircleLayer(source: Source): LayerDescription {
  return {
    type: "vector",
    source,
    point: {
      clampToGround: true,
      center: { x: 0, y: -0.5 },
    },
  };
}

/**
 * Create layer description for raster layer.
 */
function createRasterLayer(source: Source): LayerDescription {
  return {
    type: "raster",
    source,
  };
}

/**
 * Create layer description for hillshade layer.
 */
function createHillshadeLayer(source: Source): LayerDescription {
  return {
    type: "raster",
    source,
    hillshade: {},
  };
}

/**
 * Extract font from text-font layout property.
 */
function extractFont(textFont: unknown): string | undefined {
  if (Array.isArray(textFont) && textFont.length > 0) {
    return textFont[0] as string;
  }
  if (typeof textFont === "string") {
    return textFont;
  }
  return undefined;
}

/**
 * Lazy-initialized transparent placeholder image for expression-based icon-image.
 * Uses canvas.toDataURL() to create a minimal transparent PNG programmatically.
 *
 * Note: While this still produces a data: URL, it's created at runtime via Canvas
 * rather than hardcoded. In strict CSP environments where data: URLs are blocked,
 * consider using constant icon-image values instead of expressions, or configure
 * CSP to allow 'data:' for img-src.
 */
let transparentPlaceholder: string | null = null;

/**
 * Create a minimal transparent image using Canvas API.
 * Returns a data URL, but created programmatically to minimize size.
 * Falls back to SVG data URL in non-browser environments (SSR/Node).
 */
function getTransparentPlaceholder(): string {
  if (transparentPlaceholder) return transparentPlaceholder;

  // Check for browser environment before using DOM APIs
  if (typeof document === "undefined") {
    // Non-browser environment (SSR/Node) - cache and return static fallback
    transparentPlaceholder =
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'/%3E";
    return transparentPlaceholder;
  }

  try {
    // Create a 1x1 transparent canvas
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    // Canvas is already transparent by default
    transparentPlaceholder = canvas.toDataURL("image/png");
    return transparentPlaceholder;
  } catch {
    // Fallback to minimal SVG data URL if Canvas creation fails - cache it
    transparentPlaceholder =
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'/%3E";
    return transparentPlaceholder;
  }
}

/**
 * Get icon URL from layout.
 * For constant strings, returns the URL directly.
 * For expressions, returns a transparent placeholder - the actual image will be set
 * dynamically via the `image` property during feature evaluation.
 */
function getIconUrl(iconImage: unknown): string {
  // If icon-image is a constant string, use it directly
  // If it's an expression, use transparent placeholder (will be overridden via feature.image)
  return typeof iconImage === "string" && iconImage
    ? iconImage
    : getTransparentPlaceholder();
}

/**
 * Create layer description for symbol layer.
 * Returns null if the layer is misconfigured (no icon-image or text-field).
 */
function createSymbolLayer(
  source: Source,
  styleLayer: StyleLayer,
): LayerDescription | null {
  const layout = styleLayer.layout;

  // Check what this symbol layer should render based on layout properties
  const hasIconImage = layout?.["icon-image"] !== undefined;
  const hasTextField = layout?.["text-field"] !== undefined;

  if (!hasIconImage && !hasTextField) {
    // Warn but don't throw - allows loading styles with misconfigured symbol layers
    console.warn(
      `Symbol layer "${styleLayer.id}" has no icon-image or text-field configured. Skipping layer.`,
    );
    return null;
  }

  // Extract font from text-font layout property if text is needed
  let font: string | undefined;
  if (hasTextField && layout?.["text-font"]) {
    font = extractFont(layout["text-font"]);
  }

  // Warn if text is configured but no font specified
  if (hasTextField && !font) {
    console.warn(
      `Symbol layer "${styleLayer.id}" has text-field but no text-font specified. Text rendering will fail.`,
    );
  }

  // Build layer description based on what's configured
  const layerDesc: LayerDescription = {
    type: "vector",
    source,
  };

  if (hasIconImage) {
    layerDesc.billboard = {
      size: 1.0,
      height: 1,
      sizeInMeters: false,
      clampToGround: true,
      depthTest: true,
      url: getIconUrl(layout?.["icon-image"]),
      offsetDepth: true,
      transparent: true,
      center: hasTextField ? { x: 1.0, y: -0.5 } : { x: 0.5, y: -0.5 },
    };
  }

  if (hasTextField) {
    layerDesc.text = {
      clampToGround: true,
      font,
      text: "",
      size: 1.0,
      sizeInMeters: false,
      center: hasIconImage ? { x: 0.0, y: 0.0 } : { x: 0.5, y: 0.0 },
      depthTest: true,
      offsetDepth: true,
      declutter: false,
    };
  }

  return layerDesc;
}

/**
 * Convert MapLibre Style layer to Navara layer description.
 *
 * @param source - Navara source object
 * @param styleLayer - MapLibre layer specification
 * @returns Navara layer description, or null if the layer cannot be processed
 *
 * Note: Returns null for unsupported/misconfigured layers instead of throwing,
 * allowing the plugin to continue loading other layers from third-party styles.
 * Reasons for returning null:
 * - Unsupported layer type (e.g., "background", "sky")
 * - Misconfigured symbol layer (no icon-image or text-field)
 */
export function toLayerDescription(
  source: Source,
  styleLayer: StyleLayer,
): LayerDescription | null {
  switch (styleLayer.type) {
    case "fill":
      return createFillLayer(source);
    case "fill-extrusion":
      return createFillExtrusionLayer(source);
    case "line":
      return createLineLayer(source);
    case "circle":
      return createCircleLayer(source);
    case "raster":
      return createRasterLayer(source);
    case "hillshade":
      return createHillshadeLayer(source);
    case "symbol":
      return createSymbolLayer(source, styleLayer);
    default:
      // Warn but don't throw - allows loading third-party styles with unsupported layers
      // TypeScript exhaustively narrows styleLayer to never, but we handle unknown types at runtime
      console.warn(
        `Layer "${(styleLayer as StyleLayer).id}": Unsupported layer type "${(styleLayer as StyleLayer).type}". Skipping layer.`,
      );
      return null;
  }
}
