import { describe, expect, it } from "vitest";

import { generateCompositeFragmentShader } from "./CompositeShader";
import type { CompositeFeatures } from "./types";

const OFF: CompositeFeatures = {
  hasHillshade: false,
  hasWater: false,
  hasElevationHeatmap: false,
  hasWatermask: false,
};
const ALL: CompositeFeatures = {
  hasHillshade: true,
  hasWater: true,
  hasElevationHeatmap: true,
  hasWatermask: true,
};

/**
 * Characterization snapshots: pin the exact generated GLSL across a matrix of
 * slot counts and feature combinations. The composite-pass refactor (extracting
 * the base skeleton + per-layer enhancers) must keep output byte-identical —
 * these snapshots fail loudly if any character drifts.
 */
const CASES: {
  name: string;
  args: [number, number, number, CompositeFeatures];
}[] = [
  { name: "raster+vector, all features off", args: [2, 2, 2, OFF] },
  { name: "raster+single vector, boundary 24", args: [2, 1, 24, OFF] },
  { name: "single raster+2 vector, boundary 24", args: [1, 2, 24, OFF] },
  {
    name: "hillshade only",
    args: [2, 0, 24, { ...OFF, hasHillshade: true }],
  },
  { name: "water only", args: [2, 0, 24, { ...OFF, hasWater: true }] },
  {
    name: "elevation heatmap only",
    args: [2, 0, 24, { ...OFF, hasElevationHeatmap: true }],
  },
  {
    name: "watermask only feature, with slots",
    args: [2, 0, 24, { ...OFF, hasWatermask: true }],
  },
  { name: "all features on, mixed raster+vector", args: [2, 2, 2, ALL] },
  { name: "vector-only (rasterCount 0)", args: [0, 2, 24, OFF] },
  {
    name: "watermask-only shader (no slots)",
    args: [0, 0, 24, { ...OFF, hasWatermask: true }],
  },
];

describe("generateCompositeFragmentShader snapshots", () => {
  for (const { name, args } of CASES) {
    it(name, () => {
      expect(generateCompositeFragmentShader(...args)).toMatchSnapshot();
    });
  }
});
