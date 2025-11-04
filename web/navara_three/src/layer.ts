import { EventHandler, type FeatureId } from "@navara/core";
import type { Core } from "@navara/engine";

import type { ViewContext } from "./core";
import { FeatureEvaluator } from "./evaluations/FeatureEvaluator";
import type { LayerDescription } from "./type";

export type LayerEvent = {
  featureCreated: (evaluator: FeatureEvaluator) => void;
  featureUpdated: (evaluator: FeatureEvaluator, updatedAt: number) => void;
  afterFeatureUpdated: () => void;
  deleted: () => void;
};

export type FeatureEvaluatorCallback = (evaluator: FeatureEvaluator) => void;

export class Layer extends EventHandler<LayerEvent> {
  id: string;
  private core: Core;
  private viewContext: ViewContext;
  private layerType?: string;
  private featureEvaluators: Map<FeatureId, FeatureEvaluator> = new Map<
    FeatureId,
    FeatureEvaluator
  >();
  private needUpdate = false;

  constructor(
    id: string,
    core: Core,
    viewContext: ViewContext,
    layerType?: string,
  ) {
    super();

    this.id = id;
    this.core = core;
    this.viewContext = viewContext;
    this.layerType = layerType;
  }

  /**
   * Register a feature evaluator with this layer
   * @internal Used by the event system
   */
  _registerFeatureEvaluator(featureId: FeatureId, evaluator: FeatureEvaluator) {
    this.featureEvaluators.set(featureId, evaluator);
  }

  /**
   * Get a feature evaluator by ID
   * @internal Used by the event system
   */
  _getFeatureEvaluator(featureId: FeatureId): FeatureEvaluator | undefined {
    return this.featureEvaluators.get(featureId);
  }

  /**
   * Unregister a feature evaluator from this layer
   * @internal Used by the event system
   */
  _unregisterFeatureEvaluator(featureId: FeatureId) {
    this.featureEvaluators.delete(featureId);
  }

  /**
   * Process feature updates for all registered features
   * @internal Used by the animation loop
   */
  _processFeatureUpdates(updatedAt: number) {
    if (!this.needUpdate) {
      return false;
    }
    this.needUpdate = false;

    // Process all evaluators with the registered callbacks
    for (const evaluator of this.featureEvaluators.values()) {
      this.emit("featureUpdated", evaluator, updatedAt);
    }
    this.emit("afterFeatureUpdated");

    return true;
  }

  forceUpdate() {
    this.needUpdate = true;
  }

  update(l: LayerDescription) {
    // Update effects if specified in the update
    if ("effects" in l) {
      const effects = l.effects as string[] | undefined;
      const emissiveIntensity =
        "emissive_intensity" in l
          ? (l.emissive_intensity as number)
          : undefined;
      this.viewContext.updateLayerEffects(
        this.id,
        effects,
        emissiveIntensity,
        this.getEffectOptions(),
      );
    }

    this.core.updateLayer(this.id, l);
  }

  delete() {
    this.core.deleteLayer(this.id);
    this.emit("deleted");
  }

  // ==========================================
  // Effect Management Methods
  // ==========================================

  /**
   * Enable a specific effect for this layer
   * @param effectId - The ID of the effect to enable
   */
  enableEffect(effectId: string): void {
    const current = this.viewContext.getLayerEffects(this.id) ?? [];
    if (!current.includes(effectId)) {
      this.viewContext.updateLayerEffects(
        this.id,
        [...current, effectId],
        undefined,
        this.getEffectOptions(),
      );
    }
  }

  /**
   * Disable a specific effect for this layer
   * @param effectId - The ID of the effect to disable
   */
  disableEffect(effectId: string): void {
    const current = this.viewContext.getLayerEffects(this.id) ?? [];
    const updated = current.filter((id) => id !== effectId);
    this.viewContext.updateLayerEffects(
      this.id,
      updated,
      undefined,
      this.getEffectOptions(),
    );
  }

  /**
   * Toggle a specific effect for this layer
   * @param effectId - The ID of the effect to toggle
   * @param enabled - Optional explicit state. If not provided, toggles current state
   */
  toggleEffect(effectId: string, enabled?: boolean): void {
    const shouldEnable = enabled ?? !this.hasEffect(effectId);
    if (shouldEnable) {
      this.enableEffect(effectId);
    } else {
      this.disableEffect(effectId);
    }
  }

  /**
   * Set all effects for this layer, replacing any existing effects
   * @param effectIds - Array of effect IDs to set
   */
  setEffects(effectIds: string[]): void {
    this.viewContext.updateLayerEffects(
      this.id,
      effectIds,
      undefined,
      this.getEffectOptions(),
    );
  }

  /**
   * Clear all effects from this layer
   */
  clearEffects(): void {
    this.viewContext.updateLayerEffects(
      this.id,
      [],
      undefined,
      this.getEffectOptions(),
    );
  }

  /**
   * Get all currently active effects for this layer
   * @returns Array of effect IDs
   */
  getEffects(): string[] {
    return this.viewContext.getLayerEffects(this.id) ?? [];
  }

  /**
   * Check if this layer has a specific effect enabled
   * @param effectId - The ID of the effect to check
   * @returns true if the effect is enabled
   */
  hasEffect(effectId: string): boolean {
    const effects = this.viewContext.getLayerEffects(this.id) ?? [];
    return effects.includes(effectId);
  }

  /**
   * Set the emissive intensity for this layer's materials
   * @param value - The emissive intensity value (typically 0.0 to 10.0)
   */
  setEmissiveIntensity(value: number): void {
    this.viewContext.updateLayerEffects(
      this.id,
      this.viewContext.getLayerEffects(this.id),
      value,
      this.getEffectOptions(),
    );
  }

  /**
   * Get the current emissive intensity for this layer
   * @returns The emissive intensity value
   */
  getEmissiveIntensity(): number {
    return this.viewContext.getLayerEmissiveIntensity(this.id);
  }

  private getEffectOptions(): { keepClones: boolean } | undefined {
    return this.layerType === "cesium3dtiles"
      ? { keepClones: true }
      : undefined;
  }
}
