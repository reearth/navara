import { OrthographicCamera, PlaneGeometry } from "three";

// ============================================================================
// Constants
// ============================================================================

/** Effect key for Bloom selective effect */
export const SELECTIVE_BLOOM_EFFECT_KEY = "selectiveBloom" as const;

/** Effect key for Outline selective effect */
export const SELECTIVE_OUTLINE_EFFECT_KEY = "selectiveOutline" as const;

// ============================================================================
// SelectiveEffectHelper — effectId ↔ effectKey mapping
// ============================================================================

/**
 * Manages effectId → effectKey mapping.
 * Used by SelectiveEffectLayer to resolve which effect type an ID refers to.
 */
export class SelectiveEffectHelper {
  private effectKeys = new Map<string, string>(); // effectId -> effectKey

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
    this.effectKeys.delete(effectId);
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
