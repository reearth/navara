import {
  NoBlending,
  type Blending,
  type Color,
  type Material,
  type Mesh,
  type Object3D,
} from "three";

import {
  SELECTIVE_BLOOM_EFFECT_KEY,
  SELECTIVE_EFFECT_OCCLUSION_SKIP,
  SELECTIVE_OUTLINE_EFFECT_KEY,
  SelectiveEffectOcclusionMode,
  getSelectiveEffectConfig,
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
 * - SelectiveEffectHelper: Object-effect link cache
 * - MaskPassContext: Runtime state for current frame's mask rendering
 */
export type MaskPassContext = {
  /** Current mask pass phase */
  phase: MaskPassPhaseType;

  /** Active effect keys for this mask pass (e.g., ["selectiveBloom", "selectiveOutline"]) */
  activeEffects: readonly string[];

  /** Current occlusion mode filter (Normal, Silhouette, or undefined for all) */
  currentOcclusionMode: SelectiveEffectOcclusionValue | undefined;

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
  const bloomActive =
    hasBloom && ctx.activeEffects.includes(SELECTIVE_BLOOM_EFFECT_KEY);
  const outlineActive =
    hasOutline && ctx.activeEffects.includes(SELECTIVE_OUTLINE_EFFECT_KEY);
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
 * Type guard for materials with a color property (MeshStandardMaterial, MeshBasicMaterial, etc.)
 */
function hasMaterialColor(
  material: Material,
): material is Material & { color: Color } {
  return "color" in material;
}

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

// ============================================================================
// Mesh Callback Injection
// ============================================================================

/**
 * Options for injectSelectiveEffectHandlers
 */
export type SelectiveEffectHandlerOptions = {
  /** Optional registry for occlusion lookup */
  registry?: SelectiveEffectHelper;
  /** Layer ID for SoT access */
  layerId: string;
  /** Optional shader uniforms for model.ts advanced pattern */
  shaderUniforms?: {
    uBloomMaskPass?: { value: number };
    uOutlineMaskPass?: { value: number };
    uSelectiveEffectOcclusion?: { value: number };
  };
};

/**
 * Inject SelectiveEffect MaskPass processing into mesh's onBeforeRender/onAfterRender.
 *
 * This function:
 * 1. Reads material from object internally
 * 2. Wraps existing callbacks (e.g., RTE processing) with proper `this` binding
 * 3. Saves material state, applies MaskPass state during BaseMRT phase
 * 4. Restores material state in onAfterRender
 * 5. Directly assigns wrapped callbacks to the object (returns void)
 *
 * Type Safety:
 * - Uses getSelectiveEffectConfig() type guard
 * - Material array guard prevents crashes on multi-material meshes
 * - Uses `.call(object, ...)` for proper `this` binding
 *
 * @param object - Mesh object to inject handlers into
 * @param options - Handler options (registry, layerId, optional shaderUniforms)
 */
export function injectSelectiveEffectHandlers(
  object: Object3D,
  options: SelectiveEffectHandlerOptions,
): void {
  const { registry, layerId, shaderUniforms } = options;

  const mesh = object as Mesh;
  const material = mesh.material as Material | Material[] | undefined;

  // Guard: Check if material exists
  if (!material) {
    console.warn(
      "injectSelectiveEffectHandlers: object has no material",
      object,
    );
    return;
  }

  // Guard: Check if material is an array (not supported)
  if (Array.isArray(material)) {
    console.warn(
      "injectSelectiveEffectHandlers: material arrays not supported",
      object,
    );
    return;
  }

  // Save existing callbacks
  const existingBeforeRender = object.onBeforeRender;
  const existingAfterRender = object.onAfterRender;

  // Closure variables for state preservation (independent per mesh/material)
  let savedColorWrite: boolean | undefined;
  let savedDepthTest: boolean | undefined;
  let savedDepthWrite: boolean | undefined;

  // Standard material channel control (color/opacity/transparent manipulation)
  let savedColorR: number | undefined;
  let savedColorG: number | undefined;
  let savedColorB: number | undefined;
  let savedOpacity: number | undefined;
  let savedTransparent: boolean | undefined;
  let savedBlending: Blending | undefined;

  // Wrapped onBeforeRender with proper `this` binding
  object.onBeforeRender = (
    renderer,
    scene,
    camera,
    geometry,
    _material,
    group,
  ) => {
    // 1. Execute existing onBeforeRender with proper `this` binding (RTE, etc.)
    if (existingBeforeRender) {
      existingBeforeRender.call(
        object,
        renderer,
        scene,
        camera,
        geometry,
        _material,
        group,
      );
    }

    // 2. MaskPass phase check FIRST (CRITICAL: check phase before effectIds)
    const ctx = getMaskPassContext();

    if (ctx.phase !== MaskPassPhase.BaseMRT) {
      // Reset SE shader uniforms to prevent residual from previous mask pass
      if (shaderUniforms) {
        if (shaderUniforms.uBloomMaskPass)
          shaderUniforms.uBloomMaskPass.value = 0;
        if (shaderUniforms.uOutlineMaskPass)
          shaderUniforms.uOutlineMaskPass.value = 0;
        if (shaderUniforms.uSelectiveEffectOcclusion) {
          shaderUniforms.uSelectiveEffectOcclusion.value =
            SELECTIVE_EFFECT_OCCLUSION_SKIP;
        }
      }
      return; // Not in BaseMRT → skip all processing
    }

    // 3. Save state before any modifications
    savedColorWrite = material.colorWrite;
    savedDepthTest = material.depthTest;
    savedDepthWrite = material.depthWrite;

    // 4. Type-safe config retrieval (using type guard)
    const config = getSelectiveEffectConfig(object);

    // 5. Early return: effectIds check (PERFORMANCE OPTIMIZATION)
    // Even without effectIds, must apply skip state during BaseMRT to prevent rendering to mask RT
    if (!config || !config.effectIds || config.effectIds.length === 0) {
      // Reset shader uniforms to skip values (prevent residual from previous frame)
      if (shaderUniforms) {
        if (shaderUniforms.uBloomMaskPass)
          shaderUniforms.uBloomMaskPass.value = 0;
        if (shaderUniforms.uOutlineMaskPass)
          shaderUniforms.uOutlineMaskPass.value = 0;
        if (shaderUniforms.uSelectiveEffectOcclusion) {
          shaderUniforms.uSelectiveEffectOcclusion.value =
            SELECTIVE_EFFECT_OCCLUSION_SKIP;
        }
      }
      applyMaskPassSkipState(material);
      return;
    }

    // 6. Registry resolution (use passed registry or context registry)
    const resolvedRegistry = registry ?? ctx.registry;

    // 7. Evaluate and apply MaskPass state
    const evaluation = evaluateMaskPassParticipation(
      config,
      resolvedRegistry,
      layerId,
      ctx,
    );

    if (evaluation.shouldRender) {
      applyMaskPassRenderState(material, evaluation.isSilhouette);

      if (shaderUniforms) {
        // Custom shader: control via uniforms (polygon, polyline, instancedSprite, model)
        if (shaderUniforms.uBloomMaskPass) {
          shaderUniforms.uBloomMaskPass.value = evaluation.bloomActive ? 1 : 0;
        }
        if (shaderUniforms.uOutlineMaskPass) {
          shaderUniforms.uOutlineMaskPass.value = evaluation.outlineActive
            ? 1
            : 0;
        }
        if (shaderUniforms.uSelectiveEffectOcclusion) {
          shaderUniforms.uSelectiveEffectOcclusion.value =
            evaluation.isSilhouette
              ? SelectiveEffectOcclusionMode.Silhouette
              : SelectiveEffectOcclusionMode.Normal;
        }
      } else if (hasMaterialColor(material)) {
        // Standard material (Box, Sphere): control via material properties
        // Combined mask buffer expects vec4(bloomRGB, outlineA)
        // - bloom-only:   vec4(color, 0.0)
        // - outline-only: vec4(0,0,0, 1.0)
        // - both:         vec4(color, 1.0)
        savedColorR = material.color.r;
        savedColorG = material.color.g;
        savedColorB = material.color.b;
        savedOpacity = material.opacity;
        savedTransparent = material.transparent;
        savedBlending = material.blending;

        // CRITICAL: Set transparent=true to disable Three.js OPAQUE shader path.
        // When OPAQUE is active, alpha output is hardcoded to 1.0 regardless of opacity.
        // NoBlending prevents alpha blending with the mask RT clear color.
        material.transparent = true;
        material.blending = NoBlending;

        if (!evaluation.bloomActive) {
          material.color.setRGB(0, 0, 0);
        }
        material.opacity = evaluation.outlineActive ? 1.0 : 0.0;
      }
    } else {
      applyMaskPassSkipState(material);
    }
  };

  // Wrapped onAfterRender with proper `this` binding
  object.onAfterRender = (
    renderer,
    scene,
    camera,
    geometry,
    _material,
    group,
  ) => {
    // 1. Execute existing onAfterRender with proper `this` binding
    if (existingAfterRender) {
      existingAfterRender.call(
        object,
        renderer,
        scene,
        camera,
        geometry,
        _material,
        group,
      );
    }

    // 2. Restore state - CHECK ALL 3 VARIABLES (safety)
    // Only restore if all 3 states were saved (confirms BaseMRT execution)
    if (
      savedColorWrite !== undefined &&
      savedDepthTest !== undefined &&
      savedDepthWrite !== undefined
    ) {
      material.colorWrite = savedColorWrite;
      material.depthTest = savedDepthTest;
      material.depthWrite = savedDepthWrite;

      // Clear saved flags
      savedColorWrite = undefined;
      savedDepthTest = undefined;
      savedDepthWrite = undefined;
    }

    // 3. Restore standard material channel control state
    if (
      savedColorR !== undefined &&
      savedColorG !== undefined &&
      savedColorB !== undefined &&
      savedOpacity !== undefined &&
      savedTransparent !== undefined &&
      savedBlending !== undefined &&
      hasMaterialColor(material)
    ) {
      material.color.setRGB(savedColorR, savedColorG, savedColorB);
      material.opacity = savedOpacity;
      material.transparent = savedTransparent;
      material.blending = savedBlending;

      savedColorR = undefined;
      savedColorG = undefined;
      savedColorB = undefined;
      savedOpacity = undefined;
      savedTransparent = undefined;
      savedBlending = undefined;
    }
  };
}
