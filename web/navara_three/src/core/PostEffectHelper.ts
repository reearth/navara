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
  Material,
  Color,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  Group,
  Sprite,
  ShaderMaterial,
  type Camera,
  type WebGLRenderer,
  type Texture,
} from "three";

import { BufferView } from "../bufferView";
import type { Scenes } from "../scene";

// ============================================================================
// Constants
// ============================================================================

/** Effect key for Bloom post effect */
export const BLOOM_EFFECT_KEY = "bloom" as const;

/** Effect key for Outline post effect */
export const OUTLINE_EFFECT_KEY = "outline" as const;

/** Prefix for mask render target names */
export const MASK_RT_PREFIX = "PostEffectMask_" as const;

// ============================================================================
// Occlusion Mode
// ============================================================================

/**
 * Post effect occlusion modes (numeric values for shader uniforms)
 * - Normal: Standard depth test/write (default)
 * - Silhouette: No depth test/write, renders as silhouette
 */
export const PostEffectOcclusionMode = {
  Normal: 0,
  Silhouette: 2,
} as const;

export type PostEffectOcclusionValue =
  (typeof PostEffectOcclusionMode)[keyof typeof PostEffectOcclusionMode];

/**
 * Post effect occlusion mode type for API layer.
 * Used in Rust/WASM API and TypeScript public interfaces.
 */
export type PostEffectOcclusion = "normal" | "silhouette";

/**
 * Convert string occlusion value to numeric value for shader uniforms
 * @param value - String occlusion value ("normal" | "silhouette") or undefined
 * @returns Numeric PostEffectOcclusionValue, or undefined if input is undefined
 */
export function parsePostEffectOcclusion(
  value: PostEffectOcclusion | undefined,
): PostEffectOcclusionValue | undefined {
  if (value === undefined) return undefined;
  switch (value) {
    case "normal":
      return PostEffectOcclusionMode.Normal;
    case "silhouette":
      return PostEffectOcclusionMode.Silhouette;
    default:
      // Fallback to normal for unknown values
      return PostEffectOcclusionMode.Normal;
  }
}

/**
 * Sentinel value for "no mask pass active".
 * Set to Normal/Silhouette during mask passes via onBeforeRender.
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

/**
 * Initialize shader uniform uPostEffectOcclusion on material.userData.
 * Value is SKIP by default, set to Normal/Silhouette during mask passes via onBeforeRender.
 */
export function ensurePostEffectUserData(
  material: MeshStandardMaterial | MeshPhysicalMaterial | MeshLambertMaterial,
): void {
  material.userData.uPostEffectOcclusion ??= {
    value: POST_EFFECT_OCCLUSION_SKIP,
  };
}

/**
 * Apply mask pass uniforms and material settings for PostEffect rendering.
 * This is the Adapter layer between SoT (PostEffectHelper) and mesh callers.
 *
 * Sets:
 * - uBloomMaskPass: 1.0 if bloom pass and active, else 0.0
 * - uOutlineMaskPass: 1.0 if outline pass and active, else 0.0
 * - uPostEffectOcclusion: Normal/Silhouette during mask passes, SKIP otherwise
 * - depthTest/depthWrite/colorWrite: controlled during mask passes
 */
export function applyMaskPassUniforms(
  material: Material,
  pass: MaskPassType,
  activeInThisPass: boolean,
  registry: PostEffectHelper | undefined,
  layerId: string | undefined,
): void {
  // Initialize uniforms if not present
  material.userData.uBloomMaskPass ??= { value: 0.0 };
  material.userData.uOutlineMaskPass ??= { value: 0.0 };
  material.userData.uPostEffectOcclusion ??= {
    value: POST_EFFECT_OCCLUSION_SKIP,
  };

  // Set Bloom mask pass flag
  material.userData.uBloomMaskPass.value =
    pass === MaskPassTypes.Bloom && activeInThisPass ? 1.0 : 0.0;

  // Set Outline mask pass flag
  material.userData.uOutlineMaskPass.value =
    pass === MaskPassTypes.Outline && activeInThisPass ? 1.0 : 0.0;

  // Control depth test/write, colorWrite, and occlusion mode
  if (pass !== MaskPassTypes.None) {
    if (activeInThisPass) {
      // This pass is for rendering this object
      const occlusion = resolvePostEffectOcclusion(registry, layerId);
      const isSilhouette = occlusion === PostEffectOcclusionMode.Silhouette;
      material.depthTest = !isSilhouette;
      material.depthWrite = !isSilhouette;
      material.colorWrite = true;
      material.userData.uPostEffectOcclusion.value = occlusion;
    } else {
      // This pass is not for this object - suppress drawing
      material.depthTest = true;
      material.depthWrite = true;
      material.colorWrite = false;
      material.userData.uPostEffectOcclusion.value = POST_EFFECT_OCCLUSION_SKIP;
    }
  } else {
    // Normal rendering
    material.depthTest = true;
    material.depthWrite = true;
    material.colorWrite = true;
    material.userData.uPostEffectOcclusion.value = POST_EFFECT_OCCLUSION_SKIP;
  }
}

// ============================================================================
// Common Helpers
// ============================================================================

/**
 * Determine mask pass type from RenderTarget name
 * Uses RT name convention: "PostEffectMask_bloom" / "PostEffectMask_outline"
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
 * Resolve PostEffectOcclusionValue from registry for mask pass rendering.
 * @returns Normal or Silhouette (never SKIP)
 */
export function resolvePostEffectOcclusion(
  registry: PostEffectHelper | undefined,
  layerId: string | undefined,
): PostEffectOcclusionValue {
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
  private effectKeys = new Map<string, string>(); // effectId -> effectKey (e.g., "bloom")
  private effectObjectCache = new Map<string, Set<Object3D>>(); // effectKey -> objects
  private width: number;
  private height: number;
  // Occlusion cache (SoT is in PostEffectManager, this is read-only cache)
  private occlusionCache = new Map<string, PostEffectOcclusionValue>();

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  /**
   * Get cached objects for a specific effect key
   * @param effectKey - Effect key (e.g., "bloom", "outline")
   * @returns Set of objects with this effect enabled
   */
  getObjectsForEffect(effectKey: string): ReadonlySet<Object3D> {
    return this.effectObjectCache.get(effectKey) ?? new Set();
  }

  /**
   * Get all objects that have any effect enabled
   * @returns Set of all effect-enabled objects
   */
  getAllEffectObjects(): ReadonlySet<Object3D> {
    const all = new Set<Object3D>();
    for (const objects of this.effectObjectCache.values()) {
      for (const obj of objects) {
        all.add(obj);
      }
    }
    return all;
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
   * Get effect key (e.g., "bloom") for an effect ID
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
   * Sync occlusion cache from PostEffectManager
   * Called by Manager when occlusion setting changes
   */
  syncOcclusionCache(
    layerId: string,
    occlusion: PostEffectOcclusionValue,
  ): void {
    this.occlusionCache.set(layerId, occlusion);
  }

  /**
   * Get Post Effect Occlusion setting for a layer (from cache)
   */
  getLayerPostEffectOcclusion(layerId: string): PostEffectOcclusionValue {
    return this.occlusionCache.get(layerId) ?? PostEffectOcclusionMode.Normal;
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
   * Update post effect links for an object
   * Handles linking new effects and unlinking removed effects
   */
  updateLinksForObject(
    target: Object3D,
    effectIds: string[],
    prevEffectIds: string[],
    layerId: string,
  ): void {
    // Unlink removed effects
    for (const effectId of prevEffectIds) {
      if (!effectIds.includes(effectId)) {
        this.unlink(effectId, target);
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
        this.link(effectId, target, layerId);
      }
    }
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

    const effectKey = this.effectKeys.get(effectId);

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

      // Add to cache (by effectKey)
      if (effectKey) {
        let cache = this.effectObjectCache.get(effectKey);
        if (!cache) {
          cache = new Set();
          this.effectObjectCache.set(effectKey, cache);
        }
        cache.add(obj);
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

    const effectKey = this.effectKeys.get(effectId);

    const unlinkObject = (obj: Mesh | Points | Line) => {
      // Use type guard to check and narrow type
      if (!hasPostEffectConfig(obj)) {
        return;
      }

      const config = obj.userData.postEffectConfig;

      // Remove this effectId from the object's effectIds
      config.effectIds = config.effectIds.filter((id) => id !== effectId);

      // Remove from cache (by effectKey)
      if (effectKey) {
        this.effectObjectCache.get(effectKey)?.delete(obj);
      }
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

// ============================================================================
// Shared types and utilities for PostEffect passes
// (Integrated from PostEffectUtils.ts)
// ============================================================================

/**
 * Saved renderer state for restoration after mask rendering
 */
export type RendererState = {
  clearColor: Color;
  clearAlpha: number;
  renderTarget: WebGLRenderTarget | null;
};

/**
 * Save current renderer state
 */
export function saveRendererState(renderer: WebGLRenderer): RendererState {
  const clearColor = new Color();
  renderer.getClearColor(clearColor);
  return {
    clearColor,
    clearAlpha: renderer.getClearAlpha(),
    renderTarget: renderer.getRenderTarget(),
  };
}

/**
 * Restore renderer state
 */
export function restoreRendererState(
  renderer: WebGLRenderer,
  state: RendererState,
): void {
  renderer.setRenderTarget(state.renderTarget);
  renderer.setClearColor(state.clearColor, state.clearAlpha);
}

/**
 * Render mask for a specific occlusion mode
 * Shared implementation for Bloom and Outline passes
 *
 * Uses cached effect objects from PostEffectHelper for efficient filtering.
 *
 * @param renderer - WebGL renderer
 * @param camera - Camera to render with
 * @param scenes - Scenes to render
 * @param registry - PostEffectHelper for occlusion lookups and effect object cache
 * @param targetMode - PostEffectOcclusionMode.Normal or PostEffectOcclusionMode.Silhouette
 * @param targetRT - Render target to render mask to
 * @param effectKey - Effect key ("bloom", "outline") or "all" for any effect
 */
export function renderMaskForMode(
  renderer: WebGLRenderer,
  camera: Camera,
  scenes: Scenes,
  registry: PostEffectHelper | undefined,
  targetMode: PostEffectOcclusionValue,
  targetRT: WebGLRenderTarget,
  effectKey: string,
): void {
  // Save renderer state
  const state = saveRendererState(renderer);
  const visibilityChanges = new Map<Object3D, boolean>();

  // Get cached effect objects
  const effectObjects =
    effectKey === "all"
      ? (registry?.getAllEffectObjects() ?? new Set<Object3D>())
      : (registry?.getObjectsForEffect(effectKey) ?? new Set<Object3D>());

  // Traverse scenes to filter objects
  for (const sceneValue of Object.values(scenes)) {
    if (sceneValue instanceof Scene) {
      sceneValue.traverse((obj: Object3D) => {
        // 1. Renderable objects (Mesh, Points, Line)
        if (
          obj instanceof Mesh ||
          obj instanceof Points ||
          obj instanceof Line
        ) {
          // Hide if effect not enabled (not in cache)
          if (!effectObjects.has(obj)) {
            if (obj.visible) {
              visibilityChanges.set(obj, true);
              obj.visible = false;
            }
            return;
          }

          // Effect enabled - check occlusion mode
          const config = getPostEffectConfig(obj);
          const layerId = config?.layerId;
          const occlusion =
            registry?.getLayerPostEffectOcclusion(layerId ?? "") ??
            PostEffectOcclusionMode.Normal;

          // Hide if occlusion mode doesn't match target
          if (occlusion !== targetMode && obj.visible) {
            visibilityChanges.set(obj, true);
            obj.visible = false;
          }
          return;
        }

        // 2. Container objects (Scene, Group): keep visible for child rendering
        if (obj instanceof Scene || obj instanceof Group) {
          return;
        }

        // 3. Sprite: always hide from mask (not supported for post effects)
        if (obj instanceof Sprite) {
          if (obj.visible) {
            visibilityChanges.set(obj, true);
            obj.visible = false;
          }
        }
      });
    }
  }

  // Set up for mask rendering
  renderer.setRenderTarget(targetRT);
  renderer.setClearColor(0x000000, 0);
  renderer.clear(true, true, true);

  // Render scenes (only filtered objects are visible)
  for (const sceneValue of Object.values(scenes)) {
    if (sceneValue instanceof Scene) {
      renderer.render(sceneValue, camera);
    }
  }

  // Restore visibility
  for (const [obj, wasVisible] of visibilityChanges) {
    obj.visible = wasVisible;
  }

  // Restore renderer state
  restoreRendererState(renderer, state);
}

/**
 * Create depth clip material for clipping mask by base scene depth
 * Shared between Bloom and Outline passes
 */
export function createDepthClipMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      tMask: { value: null },
      tMaskDepth: { value: null },
      tBaseDepth: { value: null },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      #include <packing>

      uniform sampler2D tMask;
      uniform sampler2D tMaskDepth;
      uniform sampler2D tBaseDepth;

      varying vec2 vUv;

      void main() {
        vec4 maskColor = texture2D(tMask, vUv);

        // Simple depth comparison (pass separation handles occlusion mode)
        float baseDepth = unpackRGBAToDepth(texture2D(tBaseDepth, vUv));
        float maskDepth = texture2D(tMaskDepth, vUv).r;

        // If mask is behind Base, clip (output black)
        if (maskDepth > baseDepth + 0.0001) {
          gl_FragColor = vec4(0.0);
          return;
        }

        // Mask is in front of Base, pass through
        gl_FragColor = maskColor;
      }
    `,
    depthTest: false,
    depthWrite: false,
  });
}

/**
 * Create fullscreen rendering infrastructure
 */
export function createFullscreenQuad(): {
  camera: OrthographicCamera;
  geometry: PlaneGeometry;
} {
  return {
    camera: new OrthographicCamera(-1, 1, 1, -1, 0, 1),
    geometry: new PlaneGeometry(2, 2),
  };
}

/**
 * Apply depth clip to a mask render target
 *
 * @param renderer - WebGL renderer
 * @param depthClipMaterial - Depth clip shader material
 * @param depthClipScene - Scene containing the depth clip quad
 * @param fullscreenCamera - Orthographic camera for fullscreen rendering
 * @param maskRT - Source mask render target (with depth texture)
 * @param baseDepthTexture - Base scene depth texture (RGBA packed)
 * @param outputRT - Output render target for clipped result
 */
export function applyDepthClip(
  renderer: WebGLRenderer,
  depthClipMaterial: ShaderMaterial,
  depthClipScene: Scene,
  fullscreenCamera: OrthographicCamera,
  maskRT: WebGLRenderTarget,
  baseDepthTexture: Texture | null,
  outputRT: WebGLRenderTarget,
): void {
  depthClipMaterial.uniforms.tMask.value = maskRT.texture;
  depthClipMaterial.uniforms.tMaskDepth.value = maskRT.depthTexture;
  depthClipMaterial.uniforms.tBaseDepth.value = baseDepthTexture;
  renderer.setRenderTarget(outputRT);
  renderer.render(depthClipScene, fullscreenCamera);
}
