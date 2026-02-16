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
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  type WebGLRenderer,
  type Texture,
} from "three";
import { Color } from "three";

import { BufferView } from "../bufferView";

// ============================================================================
// Constants
// ============================================================================

/** Effect key for Bloom selective effect */
export const SELECTIVE_BLOOM_EFFECT_KEY = "selectiveBloom" as const;

/** Effect key for Outline selective effect */
export const SELECTIVE_OUTLINE_EFFECT_KEY = "selectiveOutline" as const;

// ============================================================================
// Occlusion Mode
// ============================================================================

/**
 * Sentinel value for "no mask pass active".
 * Set to Normal/Silhouette during mask passes via onBeforeRender.
 */
export const SELECTIVE_EFFECT_OCCLUSION_SKIP = -1 as const;

/**
 * Post effect occlusion modes (numeric values for shader uniforms)
 * - Normal: Standard depth test/write (default)
 * - Silhouette: No depth test/write, renders as silhouette
 */
export const SelectiveEffectOcclusionMode = {
  Normal: 0,
  Silhouette: 2,
  Skip: SELECTIVE_EFFECT_OCCLUSION_SKIP,
} as const;

export type SelectiveEffectOcclusionValue =
  (typeof SelectiveEffectOcclusionMode)[keyof typeof SelectiveEffectOcclusionMode];

/**
 * Post effect occlusion mode type for API layer.
 * Used in Rust/WASM API and TypeScript public interfaces.
 */
export type SelectiveEffectOcclusion = "normal" | "silhouette";

/**
 * Convert string occlusion value to numeric value for shader uniforms
 * @param value - String occlusion value ("normal" | "silhouette") or undefined
 * @returns Numeric SelectiveEffectOcclusionValue, or undefined if input is undefined
 */
export function parseSelectiveEffectOcclusion(
  value: SelectiveEffectOcclusion | undefined,
): SelectiveEffectOcclusionValue | undefined {
  if (value === undefined) return undefined;
  switch (value) {
    case "normal":
      return SelectiveEffectOcclusionMode.Normal;
    case "silhouette":
      return SelectiveEffectOcclusionMode.Silhouette;
    default:
      // Fallback to normal for unknown values
      return SelectiveEffectOcclusionMode.Normal;
  }
}

// ============================================================================
// Types
// ============================================================================

export type SelectiveEffectOptions = {
  resolutionScale?: number;
  debugViews?: boolean;
};

export type SelectiveEffectResources = {
  maskRT: WebGLRenderTarget;
  options: SelectiveEffectOptions;
  maskDebug?: BufferView;
};

/**
 * Post Effect Config
 * Represents the configuration of selective effects for an object.
 * Stored in Object3D.userData.selectiveEffectConfig
 *
 * Note: postEffectOcclusion is NOT stored here.
 * SoT for occlusion is SelectiveEffectManager, cached in SelectiveEffectHelper.occlusionCache,
 * accessed via layerId at runtime.
 */
export type SelectiveEffectConfig = {
  effectIds: string[]; // Always initialized as empty array
  emissiveIntensity?: number;
  emissiveColor?: Color;
  layerId?: string; // Layer ID for registry lookup (SoT access)
};

/**
 * Type guard to check if an object has SelectiveEffectConfig
 */
export function hasSelectiveEffectConfig(
  obj: unknown,
): obj is { userData: { selectiveEffectConfig: SelectiveEffectConfig } } {
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
  if (!("selectiveEffectConfig" in userData)) {
    return false;
  }

  const config = userData.selectiveEffectConfig;
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
  config: SelectiveEffectConfig | undefined,
  effectKey: string,
  registry?: SelectiveEffectHelper,
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
export function hasSelectiveBloomEffect(
  config: SelectiveEffectConfig | undefined,
  registry?: SelectiveEffectHelper,
): boolean {
  return hasEffectOfKey(config, SELECTIVE_BLOOM_EFFECT_KEY, registry);
}

/**
 * Check if Outline effect is enabled
 */
export function hasSelectiveOutlineEffect(
  config: SelectiveEffectConfig | undefined,
  registry?: SelectiveEffectHelper,
): boolean {
  return hasEffectOfKey(config, SELECTIVE_OUTLINE_EFFECT_KEY, registry);
}

/**
 * Get SelectiveEffectConfig from an object safely
 */
export function getSelectiveEffectConfig(
  obj: unknown,
): SelectiveEffectConfig | undefined {
  if (!hasSelectiveEffectConfig(obj)) {
    return undefined;
  }
  return obj.userData.selectiveEffectConfig;
}

/**
 * Initialize shader uniforms for SelectiveEffect on material.userData.
 * Values are 0 by default, set during mask passes via onBeforeRender.
 */
export function ensureSelectiveEffectUserData(
  material: MeshStandardMaterial | MeshPhysicalMaterial | MeshLambertMaterial,
): void {
  material.userData.uSelectiveEffectOcclusion ??= {
    value: SELECTIVE_EFFECT_OCCLUSION_SKIP,
  };
  material.userData.uBloomMaskPass ??= {
    value: 0.0,
  };
  material.userData.uOutlineMaskPass ??= {
    value: 0.0,
  };
}

// ============================================================================
// Common Helpers
// ============================================================================

/**
 * Resolve SelectiveEffectOcclusionValue from registry for mask pass rendering.
 * @returns Normal or Silhouette (never SKIP)
 */
export function resolveSelectiveEffectOcclusion(
  registry: SelectiveEffectHelper | undefined,
  layerId: string | undefined,
): SelectiveEffectOcclusionValue {
  if (registry && layerId) {
    return registry.getLayerSelectiveEffectOcclusion(layerId);
  }
  return SelectiveEffectOcclusionMode.Normal;
}

/**
 * Helper for managing selective effect render targets and metadata
 */
export class SelectiveEffectHelper {
  private resources = new Map<string, SelectiveEffectResources>();
  private effectKeys = new Map<string, string>(); // effectId -> effectKey (e.g., "selectiveBloom")
  private effectObjectCache = new Map<string, Set<Object3D>>(); // effectKey -> objects
  private width: number;
  private height: number;
  // Occlusion cache (SoT is in SelectiveEffectManager, this is read-only cache)
  private occlusionCache = new Map<string, SelectiveEffectOcclusionValue>();

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  /**
   * Get cached objects for a specific effect key
   * @param effectKey - Effect key (e.g., "selectiveBloom", "selectiveOutline")
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
   * Create resources for a selective effect
   */
  create(
    effectId: string,
    effectKey: string,
    options: SelectiveEffectOptions = {},
  ): SelectiveEffectResources {
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
    maskRT.texture.name = `SelectiveEffectMask_${effectKey}`;

    let maskDebug: BufferView | undefined;
    if (options.debugViews) {
      maskDebug = new BufferView(width, height);
    }

    const resources: SelectiveEffectResources = {
      maskRT,
      options,
      maskDebug,
    };

    this.resources.set(effectId, resources);
    this.effectKeys.set(effectId, effectKey);

    return resources;
  }

  /**
   * Get effect key (e.g., "selectiveBloom") for an effect ID
   */
  getEffectKey(effectId: string): string | undefined {
    return this.effectKeys.get(effectId);
  }

  /**
   * Get resources for an effect
   */
  get(effectId: string): SelectiveEffectResources | undefined {
    return this.resources.get(effectId);
  }

  /**
   * Sync occlusion cache from SelectiveEffectManager
   * Called by Manager when occlusion setting changes
   */
  syncOcclusionCache(
    layerId: string,
    occlusion: SelectiveEffectOcclusionValue,
  ): void {
    this.occlusionCache.set(layerId, occlusion);
  }

  /**
   * Clear occlusion cache for a layer
   * Called by Manager when layer is unregistered
   */
  clearOcclusionCache(layerId: string): void {
    this.occlusionCache.delete(layerId);
  }

  /**
   * Get Post Effect Occlusion setting for a layer (from cache)
   */
  getLayerSelectiveEffectOcclusion(
    layerId: string,
  ): SelectiveEffectOcclusionValue {
    return (
      this.occlusionCache.get(layerId) ?? SelectiveEffectOcclusionMode.Normal
    );
  }

  /**
   * Renderable object type for selective effects (Mesh, Points, Line)
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
   * Update selective effect links for an object
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
   * Link an object to a selective effect
   */
  link(effectId: string, sourceObject: Object3D, layerId?: string): void {
    if (!this.resources.has(effectId)) {
      // Resources not yet created for this effectId
      // This can happen if link() is called before the SelectiveEffectLayer creates resources
      console.warn(
        `[SelectiveEffectHelper.link] effectId "${effectId}" not found in resources. ` +
          `layerId: ${layerId ?? "undefined"}, object: ${sourceObject.name || sourceObject.uuid.slice(0, 8)}. ` +
          `Ensure SelectiveEffectLayer is created before linking objects.`,
      );
      return;
    }

    // Note: postEffectOcclusion is NOT copied to config.
    // SoT is layerSelectiveEffectDepthSettings, accessed via layerId at runtime.

    const effectKey = this.effectKeys.get(effectId);

    const linkObject = (obj: Mesh | Points | Line) => {
      // Initialize selectiveEffectConfig if not exists
      if (!obj.userData.selectiveEffectConfig) {
        obj.userData.selectiveEffectConfig = { effectIds: [] };
      }

      // Use type guard to narrow type
      if (!hasSelectiveEffectConfig(obj)) {
        return;
      }

      const config = obj.userData.selectiveEffectConfig;

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
   * Unlink an object from a selective effect
   */
  unlink(effectId: string, sourceObject: Object3D): void {
    if (!this.resources.has(effectId)) {
      // Resources not found - may have been destroyed or never created
      console.warn(
        `[SelectiveEffectHelper.unlink] effectId "${effectId}" not found in resources. ` +
          `object: ${sourceObject.name || sourceObject.uuid.slice(0, 8)}.`,
      );
      return;
    }

    const effectKey = this.effectKeys.get(effectId);

    const unlinkObject = (obj: Mesh | Points | Line) => {
      // Use type guard to check and narrow type
      if (!hasSelectiveEffectConfig(obj)) {
        return;
      }

      const config = obj.userData.selectiveEffectConfig;

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
      if (resources.options.debugViews) {
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

  /**
   * Enable/disable debug views for all effects
   * When enabled, creates BufferView for effects that don't have one
   * When disabled, disposes all BufferViews and removes canvas from DOM
   */
  setDebugViewsAll(enabled: boolean): void {
    for (const resources of this.resources.values()) {
      resources.options.debugViews = enabled;
      if (enabled && !resources.maskDebug) {
        resources.maskDebug = new BufferView(
          resources.maskRT.width,
          resources.maskRT.height,
        );
      } else if (!enabled && resources.maskDebug) {
        resources.maskDebug.dispose();
        resources.maskDebug = undefined;
      }
    }
  }
}

// ============================================================================
// Shared types and utilities for SelectiveEffect passes
// (Integrated from SelectiveEffectUtils.ts)
// ============================================================================

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
