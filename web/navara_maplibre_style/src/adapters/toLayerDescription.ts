/**
 * Converts MapLibre Style layer definitions to Navara LayerDescription.
 */

import { Color } from "@navara/three";
import type { LayerDescription } from "@navara/three";

import type { ParsedStyle, StyleLayer } from "../engine/types";

/**
 * Convert a MapLibre Style layer to Navara's LayerDescription format.
 *
 * @param styleLayer - MapLibre layer definition
 * @param style - Full style (for accessing sources)
 * @returns Navara LayerDescription
 */
export function toLayerDescription(
  styleLayer: StyleLayer,
  style: ParsedStyle,
): LayerDescription {
  const source = style.sources[styleLayer.source];

  if (!source) {
    throw new Error(`Source "${styleLayer.source}" not found in style`);
  }

  // Handle GeoJSON source
  if (source.type === "geojson") {
    const defaultColor = new Color().setHex(0x000000);
    return {
      type: "geojson",
      data:
        typeof source.data === "string" ? { url: source.data } : source.data,

      // just a placeholder color for now; in a real implementation, the paint properties would be evaluated to determine the actual color
      polygon: styleLayer.type === "fill" ? { color: defaultColor } : undefined,
    };
  }

  if (source.type === "vector") {
    // TODO: Handle vector tile sources
    throw new Error("Unsupported source type: vector");
  }

  // TODO: Handle other source types
  throw new Error(
    `Unsupported source type: ${(source as { type: string }).type}`,
  );
}
