/**
 * Per-compact-slot context handed to the shader-contribution hooks while the
 * base enhancer unrolls the composite slot loop.
 */
export type CompositeSlotContext = {
  /** Compact slot index `[0, rasterCount + vectorCount)`. */
  k: number;
  /** Absolute slot index baked into `winningSlot` for the main shader. */
  absSlot: number;
  /** True when the slot lives in the vector region (≥ rasterCount). */
  isVector: boolean;
};

/**
 * GLSL contributions assembled by the composite layer enhancers and consumed by
 * the base enhancer's skeleton builder. The base owns the `main()` scaffold, the
 * MRT outputs, the core uniforms, and the per-slot loop driver; everything
 * feature-specific arrives through these hooks so a new expression is a new
 * enhancer rather than an edit threaded across the generator.
 */
export type CompositeShaderContributions = {
  /**
   * Feature per-slot uniform declarations (sized at numTextures). Joined by the
   * base inside the `numTextures > 0` guard alongside the core uniforms.
   */
  slotUniformDecls: string;
  /** Slot-independent uniform declarations (e.g. the watermask sampler). */
  globalUniformDecls: string;
  /** GLSL chunks inlined before `main()` (e.g. the elevation decoder). */
  includes: string;
  /**
   * Produces `vec4 texColor${k} = …;` for a slot. Mutually exclusive — the most
   * specific contributor wins (elevation heatmap overrides the raster default).
   * Omitted → the base's default raster sampler is used.
   */
  sampleProducer?: (ctx: CompositeSlotContext) => string;
  /** Additive transform applied to `texColor${k}` after sampling (hillshade). */
  perSlotPostSample: (ctx: CompositeSlotContext) => string;
  /** Additive attr update when a slot wins the alpha-over blend (water). */
  perSlotOnWinner: (ctx: CompositeSlotContext) => string;
  /** GLSL injected after the slot loop (hillshade normal pass, watermask). */
  postLoop: string;
};
