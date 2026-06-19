import type {
  CompositeFeatures,
  CompositeGlobals,
  CompositeLayer,
} from "../../../tileTexture/types";

import type { CompositeShaderContributions } from "./tileCompositeBaseEnhancer";
import { createTileElevationHeatmapEnhancer } from "./tileElevationHeatmapEnhancer";
import { createTileHillshadeEnhancer } from "./tileHillshadeEnhancer";
import { createTileWaterEnhancer } from "./tileWaterEnhancer";
import { createTileWatermaskEnhancer } from "./tileWatermaskEnhancer";
import type { CompositeLayerEnhancer } from "./types";

/**
 * Build the ordered composite layer enhancer chain for a feature set —
 * inactive expressions return undefined and drop out. Order is significant: it
 * fixes how per-slot uniform declarations and post-loop blocks concatenate
 * (hillshade, elevation, water for slot uniforms; hillshade then watermask for
 * the post-loop). A new expression is added by writing an enhancer and slotting
 * it in here.
 */
export function createCompositeLayerEnhancers(
  features: CompositeFeatures,
): CompositeLayerEnhancer[] {
  return [
    createTileHillshadeEnhancer(features.hasHillshade),
    createTileElevationHeatmapEnhancer(features.hasElevationHeatmap),
    createTileWaterEnhancer(features.hasWater),
    createTileWatermaskEnhancer(features.hasWatermask),
  ].filter((e): e is CompositeLayerEnhancer => e !== undefined);
}

/**
 * Derive the active feature set from the planned layers and tile globals. Each
 * per-slot expression is active iff a layer of that kind is present; watermask
 * is a global. Driving the feature set off the active layers means the shader
 * never declares uniforms or runs code for a flag that no compact slot uses.
 */
export function deriveCompositeFeatures(
  layers: readonly CompositeLayer[],
  globals: CompositeGlobals,
): CompositeFeatures {
  return {
    hasHillshade: layers.some((l) => l.kind === "hillshade"),
    hasElevationHeatmap: layers.some((l) => l.kind === "elevationHeatmap"),
    hasWater: layers.some((l) => l.kind === "raster" && l.water),
    hasWatermask: globals.watermask != null,
  };
}

/**
 * Material cache key for a feature set. Stringifying the whole CompositeFeatures
 * object keeps the key unambiguous as flags are added — no hand-maintained
 * per-flag encoding to collide.
 */
export function compositeFeatureKey(features: CompositeFeatures): string {
  return JSON.stringify(features);
}

/**
 * Fold the enhancer chain into the base enhancer's contribution bundle. Each
 * hook is collected from every enhancer that defines it, in chain order:
 *   - decl/include/postLoop blocks join with "\n" (an enhancer that leaves the
 *     hook undefined simply drops out of that block),
 *   - per-slot transforms concatenate (they target the same texColor / attr),
 *   - sampleProducer takes the last active overrider (only the heatmap sets it).
 */
/** Collect the defined values of one hook across the chain, in chain order. */
function collect<T>(
  enhancers: readonly CompositeLayerEnhancer[],
  pick: (e: CompositeLayerEnhancer) => T | undefined,
): T[] {
  const out: T[] = [];
  for (const e of enhancers) {
    const v = pick(e);
    if (v !== undefined) out.push(v);
  }
  return out;
}

export function composeCompositeContributions(
  enhancers: readonly CompositeLayerEnhancer[],
  numTextures: number,
): CompositeShaderContributions {
  // Last active overrider wins (only the heatmap sets one).
  const sampleProducers = collect(enhancers, (e) => e.sampleProducer);
  const sampleProducer = sampleProducers[sampleProducers.length - 1];

  return {
    slotUniformDecls: collect(enhancers, (e) => e.slotUniformDecls)
      .map((fn) => fn(numTextures))
      .join("\n"),
    globalUniformDecls: collect(enhancers, (e) => e.globalUniformDecls)
      .map((fn) => fn())
      .join("\n"),
    includes: collect(enhancers, (e) => e.includes)
      .map((fn) => fn())
      .join("\n"),
    sampleProducer,
    perSlotPostSample: (ctx) =>
      collect(enhancers, (e) => e.perSlotPostSample)
        .map((fn) => fn(ctx))
        .join(""),
    perSlotOnWinner: (ctx) =>
      collect(enhancers, (e) => e.perSlotOnWinner)
        .map((fn) => fn(ctx))
        .join(""),
    postLoop: collect(enhancers, (e) => e.postLoop)
      .map((fn) => fn(numTextures))
      .join("\n"),
  };
}
