import type { CompositeLayerEnhancer } from "../types";

import { createWaterMutates } from "./mutates";
import { waterPerSlotOnWinner, waterSlotUniformDecls } from "./shader";

/**
 * Water layers flag the winning slot's pixel as water (attr.r), which the
 * TileMesh main shader turns into a specular reflection. Precision-sensitive
 * water params (scale, speed, …) stay in the main shader's per-slot uniform
 * arrays — only the boolean flag is baked into the atlas here.
 */
export function createTileWaterEnhancer(
  active: boolean,
): CompositeLayerEnhancer | undefined {
  if (!active) return undefined;
  const mutates = createWaterMutates();
  return {
    slotUniformDecls: waterSlotUniformDecls,
    perSlotOnWinner: waterPerSlotOnWinner,
    attachUniforms: mutates.attachUniforms,
    bindSlot: mutates.bindSlot,
  };
}
