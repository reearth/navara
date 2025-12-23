import { EventHandler, type FeatureId } from "@navara/core";
import type { Core } from "@navara/engine";

import { FeatureEvaluator } from "./evaluations";
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
  private description?: LayerDescription;
  private featureEvaluators: Map<FeatureId, FeatureEvaluator> = new Map<
    FeatureId,
    FeatureEvaluator
  >();
  private needUpdate = false;

  private convertColors?: (obj: unknown) => unknown;

  constructor(
    id: string,
    core: Core,
    convertColors?: (obj: unknown) => unknown,
  ) {
    super();

    this.id = id;
    this.core = core;
    this.convertColors = convertColors;
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

  // TODO : add docs
  _updateLayerDescription(
    update: LayerDescription,
  ): LayerDescription | undefined {
    if (!this.description) {
      return undefined;
    }

    const result: Record<string, unknown> = {
      ...(this.description as Record<string, unknown>),
    };

    const isPlainObject = (value: unknown): value is Record<string, unknown> =>
      value !== null && typeof value === "object" && !Array.isArray(value);

    for (const [key, value] of Object.entries(
      update as Record<string, unknown>,
    )) {
      if (key === "type" || value === undefined) {
        continue;
      }

      if (isPlainObject(value) && isPlainObject(result[key])) {
        result[key] = { ...(result[key] as Record<string, unknown>), ...value };
        continue;
      }

      result[key] = value;
    }

    const merged = result as LayerDescription;
    this.description = merged;
    return merged;
  }

  // TODO : add docs
  setDescription(description: LayerDescription) {
    this.description = description;
  }

  forceUpdate() {
    this.needUpdate = true;
  }

  update(l: LayerDescription) {
    // Convert Color objects to numbers if converter is provided
    const processedLayer = this.convertColors
      ? (this.convertColors(l) as LayerDescription)
      : l;
    const updatedDescription = this._updateLayerDescription(processedLayer);
    this.core.updateLayer(this.id, updatedDescription || processedLayer);
  }

  delete() {
    this.core.deleteLayer(this.id);
    this.emit("deleted");
  }
}
