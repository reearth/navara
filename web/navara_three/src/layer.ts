import { EventHandler, type FeatureId } from "@navara/core";
import type { Core } from "@navara/engine";

import { FeatureEvaluator } from "./evaluations";
import type { LayerDescription } from "./type";

export type FeatureCreatedParams = {
  featureId: FeatureId;
  evaluator: FeatureEvaluator;
  credit?: string;
};

export type FeatureRemovedParams = {
  featureId: FeatureId;
};

export type FeatureVisibilityChangedParams = {
  featureId: FeatureId;
  visible: boolean;
};

export type FeatureUpdatedParams = {
  featureId: FeatureId;
  evaluator: FeatureEvaluator;
  updatedAt: number;
};

export type LayerEvent = {
  featureCreated: (params: FeatureCreatedParams) => void;
  featureUpdated: (params: FeatureUpdatedParams) => void;
  featureRemoved: (params: FeatureRemovedParams) => void;
  featureVisibilityChanged: (params: FeatureVisibilityChangedParams) => void;
  afterFeatureUpdated: () => void;
  deleted: () => void;
};

export type FeatureEvaluatorCallback = (evaluator: FeatureEvaluator) => void;

export class Layer extends EventHandler<LayerEvent> {
  id: string;
  private core: Core;
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
      this.emit("featureUpdated", { featureId: evaluator.id, evaluator, updatedAt });
    }
    this.emit("afterFeatureUpdated");

    return true;
  }

  forceUpdate() {
    this.needUpdate = true;
  }

  update(l: LayerDescription) {
    // Convert Color objects to numbers if converter is provided
    const processedLayer = this.convertColors
      ? (this.convertColors(l) as LayerDescription)
      : l;
    this.core.updateLayer(this.id, processedLayer);
  }

  delete() {
    this.core.deleteLayer(this.id);
    this.emit("deleted");
  }
}
