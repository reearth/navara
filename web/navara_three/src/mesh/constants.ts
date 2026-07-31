/**
 * Geometry type constants for mesh objects.
 * These types are used for feature evaluation and runtime validation.
 */
export const GEOMETRY_TYPES = {
  Billboard: "billboard",
  Text: "text",
  Point: "point",
  Polyline: "polyline",
  Polygon: "polygon",
  Model: "model",
} as const;

/**
 * Array of valid geometry type values for runtime validation.
 */
export const VALID_GEOMETRY_TYPES = Object.values(GEOMETRY_TYPES);

/**
 * Type representing a valid geometry type value.
 */
export type GeometryType = (typeof GEOMETRY_TYPES)[keyof typeof GEOMETRY_TYPES];
