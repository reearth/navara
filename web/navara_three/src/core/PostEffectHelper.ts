import {
  WebGLRenderTarget,
  RGBAFormat,
  Object3D,
  Mesh,
  Points,
  Line,
  MeshStandardMaterial,
  MeshPhysicalMaterial,
  MeshLambertMaterial,
  type WebGLRenderer,
} from "three";

import { BufferView } from "../bufferView";

// ============================================================================
// Constants
// ============================================================================

/** Default emissive intensity when Bloom is enabled */
export const DEFAULT_EMISSIVE_INTENSITY = 0.3 as const;

/** Effect key for Bloom post effect */
export const BLOOM_EFFECT_KEY = "postEffectBloom" as const;

/** Effect key for Outline post effect */
export const OUTLINE_EFFECT_KEY = "postEffectOutline" as const;

/** Prefix for mask render target names */
export const MASK_RT_PREFIX = "PostEffectMask_" as const;

// ============================================================================
// Occlusion Mode
// ============================================================================

/**
 * Post effect occlusion modes
 * - Normal: Standard depth test/write (default)
 * - NoDepthTest: No depth test (reserved for future use)
 * - Silhouette: No depth test/write, renders as silhouette
 */
export const PostEffectOcclusionMode = {
  Normal: 0,
  NoDepthTest: 1,
  Silhouette: 2,
} as const;

export type PostEffectOcclusion =
  (typeof PostEffectOcclusionMode)[keyof typeof PostEffectOcclusionMode];

/**
 * Value used to skip mask pass logic during normal rendering.
 * onBeforeRender will set this to 0 (Normal) or 2 (Silhouette) during mask passes.
 */
export const POST_EFFECT_OCCLUSION_SKIP = -1 as const;

// ============================================================================
// Mask Pass Types
// ============================================================================

/**
 * Mask pass type identifiers
 */
export const MaskPassTypes = {
  None: "none",
  Bloom: "bloom",
  Outline: "outline",
} as const;

export type MaskPassType = (typeof MaskPassTypes)[keyof typeof MaskPassTypes];

// ============================================================================
// Types
// ============================================================================

export type PostEffectOptions = {
  resolutionScale?: number;
  debugMask?: boolean;
};

export type PostEffectResources = {
  maskRT: WebGLRenderTarget;
  options: PostEffectOptions;
  maskDebug?: BufferView;
};

export type EmissiveParams = {
  emissiveIntensity: number;
  emissiveColor?: number;
};

/**
 * Post Effect Config
 * Represents the configuration of post effects for an object.
 * Stored in Object3D.userData.postEffectConfig
 *
 * Note: postEffectOcclusion is NOT stored here.
 * SoT for occlusion is PostEffectHelper.layerPostEffectDepthSettings,
 * accessed via layerId at runtime.
 */
export type PostEffectConfig = {
  effectIds: string[]; // Always initialized as empty array
  emissiveIntensity?: number;
  emissiveColor?: number;
  layerId?: string; // Layer ID for registry lookup (SoT access)
};

/**
 * Type guard to check if an object has PostEffectConfig
 */
export function hasPostEffectConfig(
  obj: unknown,
): obj is { userData: { postEffectConfig: PostEffectConfig } } {
  if (
    typeof obj !== "object" ||
    obj === null ||
    !("userData" in obj) ||
    typeof obj.userData !== "object" ||
    obj.userData === null
  ) {
    return false;
  }

  const userData = obj.userData as Record<string, unknown>;
  if (!("postEffectConfig" in userData)) {
    return false;
  }

  const config = userData.postEffectConfig;
  if (typeof config !== "object" || config === null) {
    return false;
  }

  return true;
}

/**
 * Generic helper to check if an effect of a specific key is enabled
 * If registry is provided, checks effectKeys; otherwise checks config.effectIds for the effectKey string
 */
function hasEffectOfKey(
  config: PostEffectConfig | undefined,
  effectKey: string,
  registry?: PostEffectHelper,
): boolean {
  if (!config || config.effectIds.length === 0) {
    return false;
  }

  if (registry) {
    return config.effectIds.some(
      (id) => registry.getEffectKey(id) === effectKey,
    );
  }

  return config.effectIds.includes(effectKey);
}

/**
 * Check if Bloom effect is enabled
 */
export function hasBloomEffect(
  config: PostEffectConfig | undefined,
  registry?: PostEffectHelper,
): boolean {
  return hasEffectOfKey(config, BLOOM_EFFECT_KEY, registry);
}

/**
 * Check if Outline effect is enabled
 */
export function hasOutlineEffect(
  config: PostEffectConfig | undefined,
  registry?: PostEffectHelper,
): boolean {
  return hasEffectOfKey(config, OUTLINE_EFFECT_KEY, registry);
}

/**
 * Get PostEffectConfig from an object safely
 */
export function getPostEffectConfig(
  obj: unknown,
): PostEffectConfig | undefined {
  if (!hasPostEffectConfig(obj)) {
    return undefined;
  }
  return obj.userData.postEffectConfig;
}

type PostEffectUserData = {
  // Post effect occlusion mode value.
  // 0 = Normal (DepthTest+Write), 2 = Silhouette (No DepthTest/Write)
  postEffectOcclusion: { value: number };
};

export function ensurePostEffectUserData(
  material: MeshStandardMaterial | MeshPhysicalMaterial | MeshLambertMaterial,
): PostEffectUserData {
  const ud = (material.userData.postEffect ??= {});
  if (
    !("postEffectOcclusion" in ud) ||
    typeof ud.postEffectOcclusion?.value !== "number"
  ) {
    // Initialize to skip mask pass logic during normal rendering
    // onBeforeRender will set this to 0 or 2 during mask passes
    ud.postEffectOcclusion = { value: POST_EFFECT_OCCLUSION_SKIP };
  }
  return ud as PostEffectUserData;
}

export function applyEmissiveEffect(
  material: MeshStandardMaterial | MeshPhysicalMaterial,
  params: EmissiveParams,
): void {
  const { emissiveIntensity, emissiveColor } = params;

  if (emissiveColor !== undefined) {
    material.emissive.set(emissiveColor);
  } else {
    material.emissive.copy(material.color);
  }

  material.emissiveIntensity = emissiveIntensity;
}

export function updatePostEffectLinksForObject(
  target: Object3D,
  registry: PostEffectHelper | undefined,
  effectIds: string[],
  prevEffectIds: string[],
  layerId: string,
): void {
  if (!registry) return;

  // Unlink removed effects
  for (const effectId of prevEffectIds) {
    if (!effectIds.includes(effectId)) {
      registry.unlink(effectId, target);
    }
  }

  // Update world matrix if needed for new links
  const needsLink = effectIds.some(
    (effectId) => !prevEffectIds.includes(effectId),
  );
  if (needsLink) {
    target.updateMatrixWorld(true);
  }

  // Link new effects
  for (const effectId of effectIds) {
    if (!prevEffectIds.includes(effectId)) {
      registry.link(effectId, target, layerId);
    }
  }
}

// ============================================================================
// Common Helpers
// ============================================================================

/**
 * Determine mask pass type from RenderTarget name
 * Uses RT name convention: "PostEffectMask_postEffectBloom" / "PostEffectMask_postEffectOutline"
 */
export function getMaskPassType(rt: WebGLRenderTarget | null): MaskPassType {
  const name = rt?.texture?.name ?? "";
  if (name.includes(`${MASK_RT_PREFIX}${BLOOM_EFFECT_KEY}`))
    return MaskPassTypes.Bloom;
  if (name.includes(`${MASK_RT_PREFIX}${OUTLINE_EFFECT_KEY}`))
    return MaskPassTypes.Outline;
  return MaskPassTypes.None;
}

/**
 * Resolve PostEffectOcclusion value from registry
 * Used as the runtime source of truth for occlusion during mask passes.
 * Returns number value (0=Normal, 1=NoDepthTest, 2=Silhouette)
 */
export function resolvePostEffectOcclusion(
  registry: PostEffectHelper | undefined,
  layerId: string | undefined,
): number {
  if (registry && layerId) {
    return registry.getLayerPostEffectOcclusion(layerId);
  }
  return PostEffectOcclusionMode.Normal;
}

/**
 * Result of resolveActiveEffects
 */
export type ActiveEffectsResult = {
  hasBloom: boolean;
  hasOutline: boolean;
  activeInThisPass: boolean;
};

/**
 * Determine active effects for the current mask pass
 */
export function resolveActiveEffects(
  config: PostEffectConfig | undefined,
  registry: PostEffectHelper | undefined,
  pass: MaskPassType,
): ActiveEffectsResult {
  const hasBloom = hasBloomEffect(config, registry);
  const hasOutline = hasOutlineEffect(config, registry);

  const activeInThisPass =
    (pass === MaskPassTypes.Bloom && hasBloom) ||
    (pass === MaskPassTypes.Outline && hasOutline);

  return { hasBloom, hasOutline, activeInThisPass };
}

/**
 * Helper for managing post effect render targets and metadata
 */
export class PostEffectHelper {
  private resources = new Map<string, PostEffectResources>();
  private effectKeys = new Map<string, string>(); // effectId -> effectKey (e.g., "postEffectBloom")
  private width: number;
  private height: number;
  private layerPostEffectDepthSettings = new Map<string, number>();

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  /**
   * Create resources for a post effect
   */
  create(
    effectId: string,
    effectKey: string,
    options: PostEffectOptions = {},
  ): PostEffectResources {
    if (this.resources.has(effectId)) {
      throw new Error(`Post effect ${effectId} already exists`);
    }

    const resolutionScale = options.resolutionScale ?? 1.0;
    const width = Math.floor(this.width * resolutionScale);
    const height = Math.floor(this.height * resolutionScale);

    const maskRT = new WebGLRenderTarget(width, height, {
      format: RGBAFormat,
      depthBuffer: true,
      stencilBuffer: true,
    });
    maskRT.texture.name = `PostEffectMask_${effectKey}`;

    let maskDebug: BufferView | undefined;
    if (options.debugMask) {
      maskDebug = new BufferView(width, height);
    }

    const resources: PostEffectResources = {
      maskRT,
      options,
      maskDebug,
    };

    this.resources.set(effectId, resources);
    this.effectKeys.set(effectId, effectKey);

    return resources;
  }

  /**
   * Get effect key (e.g., "postEffectBloom") for an effect ID
   */
  getEffectKey(effectId: string): string | undefined {
    return this.effectKeys.get(effectId);
  }

  /**
   * Get resources for an effect
   */
  get(effectId: string): PostEffectResources | undefined {
    return this.resources.get(effectId);
  }

  /**
   * Register Post Effect Occlusion setting for a layer
   */
  registerLayerPostEffectOcclusion(
    layerId: string,
    postEffectOcclusion: number,
  ): void {
    this.layerPostEffectDepthSettings.set(layerId, postEffectOcclusion);
  }

  /**
   * Get Post Effect Occlusion setting for a layer
   */
  getLayerPostEffectOcclusion(layerId: string): number {
    return (
      this.layerPostEffectDepthSettings.get(layerId) ??
      PostEffectOcclusionMode.Normal
    );
  }

  /**
   * Update Post Effect Occlusion for a layer
   */
  updateLayerPostEffectOcclusion(
    layerId: string,
    postEffectOcclusion: number,
  ): void {
    this.layerPostEffectDepthSettings.set(layerId, postEffectOcclusion);
  }

  /**
   * Renderable object type for post effects (Mesh, Points, Line)
   */
  private forEachRenderableObject(
    object: Object3D,
    callback: (obj: Mesh | Points | Line) => void,
  ): void {
    object.traverse((child) => {
      if (
        child instanceof Mesh ||
        child instanceof Points ||
        child instanceof Line
      ) {
        callback(child);
      }
    });
  }

  /**
   * Link an object to a post effect
   */
  link(effectId: string, sourceObject: Object3D, layerId?: string): void {
    if (!this.resources.has(effectId)) {
      // Resources not yet created for this effectId
      // This can happen if link() is called before the PostEffectLayer creates resources
      console.warn(
        `[PostEffectHelper.link] effectId "${effectId}" not found in resources. ` +
          `layerId: ${layerId ?? "undefined"}, object: ${sourceObject.name || sourceObject.uuid.slice(0, 8)}. ` +
          `Ensure PostEffectLayer is created before linking objects.`,
      );
      return;
    }

    // Note: postEffectOcclusion is NOT copied to config.
    // SoT is layerPostEffectDepthSettings, accessed via layerId at runtime.

    const linkObject = (obj: Mesh | Points | Line) => {
      // Initialize postEffectConfig if not exists
      if (!obj.userData.postEffectConfig) {
        obj.userData.postEffectConfig = { effectIds: [] };
      }

      // Use type guard to narrow type
      if (!hasPostEffectConfig(obj)) {
        return;
      }

      const config = obj.userData.postEffectConfig;

      // Add this effectId to the object's effectIds
      if (!config.effectIds.includes(effectId)) {
        config.effectIds = [...config.effectIds, effectId];
      }

      // Save layerId for registry lookup (SoT access)
      if (layerId) {
        config.layerId = layerId;
      }
    };

    this.forEachRenderableObject(sourceObject, linkObject);
  }

  /**
   * Unlink an object from a post effect
   */
  unlink(effectId: string, sourceObject: Object3D): void {
    if (!this.resources.has(effectId)) {
      // Resources not found - may have been destroyed or never created
      console.warn(
        `[PostEffectHelper.unlink] effectId "${effectId}" not found in resources. ` +
          `object: ${sourceObject.name || sourceObject.uuid.slice(0, 8)}.`,
      );
      return;
    }

    const unlinkObject = (obj: Mesh | Points | Line) => {
      // Use type guard to check and narrow type
      if (!hasPostEffectConfig(obj)) {
        return;
      }

      const config = obj.userData.postEffectConfig;

      // Remove this effectId from the object's effectIds
      config.effectIds = config.effectIds.filter((id) => id !== effectId);
    };

    this.forEachRenderableObject(sourceObject, unlinkObject);
  }

  /**
   * Resize render targets
   */
  setSize(width: number, height: number): void {
    this.width = width;
    this.height = height;

    for (const resources of this.resources.values()) {
      const resolutionScale = resources.options.resolutionScale ?? 1.0;
      const w = Math.floor(width * resolutionScale);
      const h = Math.floor(height * resolutionScale);

      resources.maskRT.setSize(w, h);

      // Recreate debug view if enabled
      if (resources.options.debugMask) {
        resources.maskDebug?.dispose();
        resources.maskDebug = new BufferView(w, h);
      }
    }
  }

  /**
   * Destroy resources for an effect
   */
  destroy(effectId: string): void {
    const resources = this.resources.get(effectId);
    if (!resources) {
      return;
    }

    // Dispose render targets
    resources.maskRT.dispose();

    // Dispose debug view
    resources.maskDebug?.dispose();

    this.resources.delete(effectId);
  }

  /**
   * Destroy all resources
   */
  dispose(): void {
    for (const effectId of Array.from(this.resources.keys())) {
      this.destroy(effectId);
    }
  }

  /**
   * Render debug buffer views for all postEffect effects
   */
  renderDebugViews(renderer: WebGLRenderer): void {
    for (const resources of this.resources.values()) {
      if (!resources.maskDebug) continue;
      resources.maskDebug.render(renderer, resources.maskRT);
    }
  }
}
