import {
  Object3D,
  Mesh,
  Points,
  Line,
  OrthographicCamera,
  PlaneGeometry,
} from "three";

// ============================================================================
// Constants
// ============================================================================

/** Effect key for Bloom selective effect */
export const SELECTIVE_BLOOM_EFFECT_KEY = "selectiveBloom" as const;

/** Effect key for Outline selective effect */
export const SELECTIVE_OUTLINE_EFFECT_KEY = "selectiveOutline" as const;

// ============================================================================
// Types
// ============================================================================

/**
 * Selective Effect Config — stored in Object3D.userData.selectiveEffectConfig.
 * Represents which effects apply to an object.
 */
export type SelectiveEffectConfig = {
  effectIds: string[];
  layerId?: string;
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

// ============================================================================
// SelectiveEffectHelper — object ↔ effect link management
// ============================================================================

/**
 * Manages object-to-effect linkage via userData.selectiveEffectConfig.
 * Used by ViewContext to track which objects have which effects applied.
 */
export class SelectiveEffectHelper {
  private effectKeys = new Map<string, string>(); // effectId -> effectKey
  private effectObjectCache = new Map<string, Set<Object3D>>(); // effectKey -> objects

  /**
   * Register an effect key for an effect ID
   */
  registerEffectKey(effectId: string, effectKey: string): void {
    this.effectKeys.set(effectId, effectKey);
  }

  /**
   * Unregister an effect key for an effect ID
   */
  unregisterEffectKey(effectId: string): void {
    const effectKey = this.effectKeys.get(effectId);
    this.effectKeys.delete(effectId);
    if (effectKey) {
      this.effectObjectCache.delete(effectKey);
    }
  }

  /**
   * Get effect key for an effect ID
   */
  getEffectKey(effectId: string): string | undefined {
    return this.effectKeys.get(effectId);
  }

  /**
   * Update selective effect links for an object.
   * Handles linking new effects and unlinking removed effects.
   */
  updateLinksForObject(
    target: Object3D,
    effectIds: string[],
    prevEffectIds: string[],
    layerId: string,
  ): void {
    for (const effectId of prevEffectIds) {
      if (!effectIds.includes(effectId)) {
        this.unlink(effectId, target);
      }
    }

    const needsLink = effectIds.some(
      (effectId) => !prevEffectIds.includes(effectId),
    );
    if (needsLink) {
      target.updateMatrixWorld(true);
    }

    for (const effectId of effectIds) {
      if (!prevEffectIds.includes(effectId)) {
        this.link(effectId, target, layerId);
      }
    }
  }

  private link(
    effectId: string,
    sourceObject: Object3D,
    layerId?: string,
  ): void {
    const effectKey = this.effectKeys.get(effectId);

    this.forEachRenderableObject(sourceObject, (obj) => {
      if (!obj.userData.selectiveEffectConfig) {
        obj.userData.selectiveEffectConfig = { effectIds: [] };
      }

      if (!hasSelectiveEffectConfig(obj)) {
        return;
      }

      const config = obj.userData.selectiveEffectConfig;

      if (!config.effectIds.includes(effectId)) {
        config.effectIds = [...config.effectIds, effectId];
      }

      if (layerId) {
        config.layerId = layerId;
      }

      if (effectKey) {
        let cache = this.effectObjectCache.get(effectKey);
        if (!cache) {
          cache = new Set();
          this.effectObjectCache.set(effectKey, cache);
        }
        cache.add(obj);
      }

      obj.addEventListener("removed", () => {
        this.disposeFromCache(effectId, obj);
      });
    });
  }

  private unlink(effectId: string, sourceObject: Object3D): void {
    this.forEachRenderableObject(sourceObject, (obj) => {
      if (!hasSelectiveEffectConfig(obj)) {
        return;
      }

      const config = obj.userData.selectiveEffectConfig;
      config.effectIds = config.effectIds.filter((id) => id !== effectId);

      this.disposeFromCache(effectId, obj);
    });
  }

  private disposeFromCache(effectId: string, obj: Object3D): void {
    const effectKey = this.effectKeys.get(effectId);
    if (effectKey) {
      this.effectObjectCache.get(effectKey)?.delete(obj);
    }
  }

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
}

// ============================================================================
// Shared utilities for SelectiveEffect passes
// ============================================================================

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
