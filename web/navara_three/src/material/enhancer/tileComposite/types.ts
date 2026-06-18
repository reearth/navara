import type { Texture } from "three";

import type {
  CompositeGlobals,
  CompositeLayer,
} from "../../../tileTexture/types";

import type {
  CompositeShaderContributions,
  CompositeSlotContext,
  CompositeUniformTarget,
} from "./tileCompositeBaseEnhancer";

/**
 * A composite layer enhancer owns one expression's contribution to the
 * offscreen composite pass — both its GLSL fragments and its uniforms. The
 * factory returns `undefined` when the expression is inactive, so the composed
 * chain contains only active enhancers and the composer just concatenates what
 * each one provides. Adding a new expression is a new enhancer module + one
 * entry in `createCompositeLayerEnhancers`.
 *
 * Every hook is optional; an enhancer exposes only the ones it participates in.
 */
export type CompositeLayerEnhancer = {
  /** Per-slot uniform declarations (sized at numTextures). */
  slotUniformDecls?: (numTextures: number) => string;
  /** Slot-independent uniform declarations. */
  globalUniformDecls?: () => string;
  /** GLSL chunks inlined before `main()`. */
  includes?: () => string;
  /** Overrides the per-slot sampler (only the active overrider sets it). */
  sampleProducer?: CompositeShaderContributions["sampleProducer"];
  /** Additive transform on `texColor${k}` after sampling. */
  perSlotPostSample?: (ctx: CompositeSlotContext) => string;
  /** Additive attr update when a slot wins the alpha-over blend. */
  perSlotOnWinner?: (ctx: CompositeSlotContext) => string;
  /** GLSL injected after the slot loop. */
  postLoop?: (numTextures: number) => string;

  // --- material defines + uniform ownership (active enhancers only) ---
  /** Shader defines this enhancer needs (e.g. USE_ELEVATION_HEATMAP). */
  defines?: Record<string, number>;
  /**
   * Create this enhancer's uniform refs (sized at numTextures) and assign them
   * into the composite material's uniform dict. Refs are held in closure so
   * `bindSlot`/`bindGlobal` mutate the same objects three.js owns. Defined only
   * when the enhancer is active.
   */
  attachUniforms?: (
    target: CompositeUniformTarget,
    numTextures: number,
    placeholder: Texture,
  ) => void;
  /** Sync per-slot refs from the layer occupying compact slot `compactSlot`. */
  bindSlot?: (compactSlot: number, layer: CompositeLayer | undefined) => void;
  /** Sync slot-independent refs from the tile globals. */
  bindGlobal?: (globals: CompositeGlobals) => void;
};
