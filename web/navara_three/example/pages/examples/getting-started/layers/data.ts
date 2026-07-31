import type { FeatureCollection, Position } from "geojson";

/**
 * One GeoJSON FeatureCollection mixing every vector geometry kind, laid out
 * as a tidy west-to-east row so each geometry reads at a glance:
 *
 * - Points — three dots in a north-south line
 * - LineString — a zigzag route
 * - Polygon — a flat square draped on the ground
 * - Polygon with `extrudedHeight` — a square block raised to 120 m
 *
 * The stage is the Azusa river valley near Kamikochi (Northern Japan Alps) —
 * an almost featureless part of the grayscale basemap, so the data is the
 * only thing that draws the eye. Every exhibit is centered on ROW.lat and
 * spans the same north-south range so the row reads as one straight line.
 */

/** Center of the exhibit row — just north of the Azusa river and Taisho pond. */
const ROW = { lng: 137.6495, lat: 36.2445 };
/** Distance between exhibit centers, in degrees of longitude (~240 m). */
const SPACING = 0.0027;
/** Exhibits span ROW.lat ± HALF_NS (~200 m north-south in total). */
const HALF_NS = 0.0009;
/** Half-width of the squares, scaled so they render square at this latitude. */
const HALF_EW = 0.0011;

/** Longitude of the exhibit at `index` (0 = westmost of the four). */
const exhibitLng = (index: number): number => ROW.lng + (index - 1.5) * SPACING;

/** A square ring centered on the row line at `centerLng`. */
const squareRing = (centerLng: number): Position[][] => [
  [
    [centerLng - HALF_EW, ROW.lat - HALF_NS],
    [centerLng + HALF_EW, ROW.lat - HALF_NS],
    [centerLng + HALF_EW, ROW.lat + HALF_NS],
    [centerLng - HALF_EW, ROW.lat + HALF_NS],
    [centerLng - HALF_EW, ROW.lat - HALF_NS],
  ],
];

export const features: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    ...([-1, 0, 1] as const).map((step, i) => ({
      type: "Feature" as const,
      properties: { name: `Point ${["A", "B", "C"][i]}` },
      geometry: {
        type: "Point" as const,
        coordinates: [exhibitLng(0), ROW.lat + step * HALF_NS],
      },
    })),
    {
      type: "Feature",
      properties: { name: "Route" },
      geometry: {
        type: "LineString",
        coordinates: [-1, -0.5, 0, 0.5, 1].map((step, i) => [
          exhibitLng(1) + (i % 2 === 0 ? -0.0004 : 0.0004),
          ROW.lat + step * HALF_NS,
        ]),
      },
    },
    {
      type: "Feature",
      properties: { name: "Area" },
      geometry: { type: "Polygon", coordinates: squareRing(exhibitLng(2)) },
    },
    {
      type: "Feature",
      properties: { name: "Block", extrudedHeight: 120 },
      geometry: { type: "Polygon", coordinates: squareRing(exhibitLng(3)) },
    },
  ],
};
