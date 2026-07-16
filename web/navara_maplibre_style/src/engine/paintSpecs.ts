/**
 * Paint property specifications from MapLibre Style Spec.
 * Separated from types.ts to avoid pulling the full style-spec into bundles
 * when consumers only need type definitions or utility functions.
 */

import { v8 } from "@maplibre/maplibre-gl-style-spec";

/**
 * MapLibre's official paint property specifications by layer type.
 * Using the official specs ensures compatibility with the MapLibre Style spec.
 */
export const PAINT_SPECS_BY_TYPE = {
  fill: v8.paint_fill,
  line: v8.paint_line,
  circle: v8.paint_circle,
};
