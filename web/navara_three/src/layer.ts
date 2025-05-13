import { EventHandler } from "@navara/core/src/eventHandler";
import type { Core } from "navara_wasm";

import { FeatureEvaluator } from "./evaluations/FeatureEvaluator";
import type { LayerDescription } from "./type";
import type { FeatureId } from "./types";

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
  private featureEvaluators: Map<FeatureId, FeatureEvaluator> = new Map<
    FeatureId,
    FeatureEvaluator
  >();
  private needUpdate = false;

  constructor(id: string, core: Core) {
    super();

    this.id = id;
    this.core = core;
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
    this.core.updateLayer(this.id, l);
  }

  delete() {
    this.core.deleteLayer(this.id);
    this.emit("deleted");
  }
}
