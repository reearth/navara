import type { Material, WebGLRenderTarget } from "three";

import {
  BLOOM_EFFECT_KEY,
  OUTLINE_EFFECT_KEY,
  SelectiveEffectOcclusionMode,
  hasSelectiveBloomEffect,
  hasSelectiveOutlineEffect,
  resolveSelectiveEffectOcclusion,
  type SelectiveEffectConfig,
  type SelectiveEffectHelper,
  type SelectiveEffectOcclusionValue,
} from "./SelectiveEffectHelper";

// ============================================================================
// Mask Pass Phase
// ============================================================================

/**
 * Mask pass phase identifiers
 * - none: No mask pass active (normal rendering)
 * - baseMRT: Mask rendering during BaseMRT phase (CustomRenderPass)
 */
export const MaskPassPhase = {
  None: "none",
  BaseMRT: "baseMRT",
} as const;

export type MaskPassPhaseType =
  (typeof MaskPassPhase)[keyof typeof MaskPassPhase];

// ============================================================================
// Mask Pass Context
// ============================================================================

/**
 * Context for mask pass rendering.
 * Provides runtime state for mesh onBeforeRender callbacks to determine
 * their rendering behavior during mask passes.
 *
 * SoT Hierarchy:
 * - SelectiveEffectManager: Source of truth for layer configurations
 * - SelectiveEffectHelper: Resource management (maskRTs) and object cache
 * - MaskPassContext: Runtime state for current frame's mask rendering
 */
export type MaskPassContext = {
  /** Current mask pass phase */
  phase: MaskPassPhaseType;

  /** Active effect keys for this mask pass (e.g., ["bloom", "outline"]) */
  activeEffects: readonly string[];

  /** Current occlusion mode filter (Normal, Silhouette, or undefined for all) */
  currentOcclusionMode: SelectiveEffectOcclusionValue | undefined;

  /** Mask render targets by effect key */
  maskRenderTargets: ReadonlyMap<string, WebGLRenderTarget>;

  /** SelectiveEffectHelper reference for occlusion lookups and effect checks */
  registry: SelectiveEffectHelper | undefined;
};

/**
 * Default context when no mask pass is active
 */
const DEFAULT_CONTEXT: MaskPassContext = {
  phase: MaskPassPhase.None,
  activeEffects: [],
  currentOcclusionMode: undefined,
  maskRenderTargets: new Map(),
  registry: undefined,
};

// ============================================================================
// Global Context State
// ============================================================================

/**
 * Current mask pass context (module-level singleton).
 * Set during BaseMRT phase, reset after rendering.
 */
let currentContext: MaskPassContext = { ...DEFAULT_CONTEXT };

/**
 * Get the current mask pass context.
 * Used by mesh onBeforeRender callbacks to determine rendering behavior.
 *
 * @returns Current MaskPassContext (readonly)
 */
export function getMaskPassContext(): Readonly<MaskPassContext> {
  return currentContext;
}

/**
 * Set mask pass context for the current frame.
 * Called by CustomRenderPass at the start of BaseMRT phase.
 *
 * @param ctx - Partial context to merge with current state
 */
export function setMaskPassContext(ctx: Partial<MaskPassContext>): void {
  currentContext = {
    ...currentContext,
    ...ctx,
  };
}

/**
 * Reset mask pass context to default state.
 * Called by CustomRenderPass after BaseMRT phase completes.
 */
export function resetMaskPassContext(): void {
  currentContext = { ...DEFAULT_CONTEXT };
}

// ============================================================================
// Mask Pass Evaluation
// ============================================================================

/**
 * Result of mask pass participation evaluation.
 */
export type MaskPassEvaluation = {
  /** Whether this mesh should render to the current mask pass */
  shouldRender: boolean;
  /** Whether this mesh uses Silhouette occlusion mode */
  isSilhouette: boolean;
  /** Resolved occlusion value (Normal or Silhouette) */
  occlusion: SelectiveEffectOcclusionValue;
  /** Whether bloom effect is active for this mesh in this pass */
  bloomActive: boolean;
  /** Whether outline effect is active for this mesh in this pass */
  outlineActive: boolean;
};

/**
 * Evaluate mask pass participation for a mesh.
 *
 * This function determines whether a mesh should render to the current mask pass
 * based on its SelectiveEffectConfig, the active effects in the context, and occlusion mode.
 *
 * @param config - SelectiveEffectConfig from the mesh (or undefined)
 * @param registry - SelectiveEffectHelper for effect lookups
 * @param layerId - Layer ID for occlusion mode lookup
 * @param ctx - Current MaskPassContext
 * @returns Evaluation result with render decisions
 */
export function evaluateMaskPassParticipation(
  config: SelectiveEffectConfig | undefined,
  registry: SelectiveEffectHelper | undefined,
  layerId: string | undefined,
  ctx: MaskPassContext,
): MaskPassEvaluation {
  // Check if this mesh has any active effects
  const hasBloom = hasSelectiveBloomEffect(config, registry);
  const hasOutline = hasSelectiveOutlineEffect(config, registry);

  // Check if this mesh should render to the current mask pass
  const bloomActive = hasBloom && ctx.activeEffects.includes(BLOOM_EFFECT_KEY);
  const outlineActive =
    hasOutline && ctx.activeEffects.includes(OUTLINE_EFFECT_KEY);
  const shouldRenderToMask = bloomActive || outlineActive;

  if (!shouldRenderToMask) {
    return {
      shouldRender: false,
      isSilhouette: false,
      occlusion: SelectiveEffectOcclusionMode.Normal,
      bloomActive: false,
      outlineActive: false,
    };
  }

  // Resolve occlusion mode from SoT (SelectiveEffectManager via registry)
  const occlusion = resolveSelectiveEffectOcclusion(registry, layerId);

  // Check if this mesh's occlusion mode matches the current pass
  if (
    ctx.currentOcclusionMode !== undefined &&
    occlusion !== ctx.currentOcclusionMode
  ) {
    // Occlusion mode doesn't match - skip this mesh in this pass
    return {
      shouldRender: false,
      isSilhouette: occlusion === SelectiveEffectOcclusionMode.Silhouette,
      occlusion,
      bloomActive,
      outlineActive,
    };
  }

  const isSilhouette = occlusion === SelectiveEffectOcclusionMode.Silhouette;

  return {
    shouldRender: true,
    isSilhouette,
    occlusion,
    bloomActive,
    outlineActive,
  };
}

// ============================================================================
// Material State Management
// ============================================================================

/**
 * Apply render state for mask pass skip.
 * Used when mesh doesn't contribute to current mask pass.
 *
 * @param material - Material to modify
 */
export function applyMaskPassSkipState(material: Material): void {
  material.colorWrite = false;
  material.depthWrite = false;
  material.depthTest = true;
}

/**
 * Apply render state for mask pass rendering.
 * Sets depth behavior based on occlusion mode.
 *
 * @param material - Material to modify
 * @param isSilhouette - Whether Silhouette occlusion mode is active
 */
export function applyMaskPassRenderState(
  material: Material,
  isSilhouette: boolean,
): void {
  // Silhouette: no depth test/write (always visible)
  // Normal: with depth test/write (occluded by scene)
  material.depthTest = !isSilhouette;
  material.depthWrite = !isSilhouette;
  material.colorWrite = true;
}

/**
 * Restore material to normal rendering state.
 * Called after mask pass or when not in mask pass.
 *
 * @param material - Material to restore
 */
export function restoreMaterialState(material: Material): void {
  material.colorWrite = true;
  material.depthWrite = true;
  material.depthTest = true;
}
