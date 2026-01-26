import { EventHandler, type FeatureId } from "@navara/core";
import type { Core } from "@navara/engine";

import { FeatureEvaluator } from "./evaluations";
import type { LayerDescription } from "./type";

export type FeatureCreatedParams = {
  id: FeatureId;
  evaluator: FeatureEvaluator;
  credit?: string;
};

export type FeatureRemovedParams = {
  id: FeatureId;
  credit?: string;
};

export type FeatureVisibilityChangedParams = {
  id: FeatureId;
  visible: boolean;
};

/**
 * Events emitted by Layer. Subscribe using `layer.on(eventName, callback)`.
 */
export type LayerEvent = {
  /** Emitted when a new feature is created in this layer. */
  featureCreated: (evaluator: FeatureEvaluator) => void;
  /** Emitted when a feature in this layer is updated. */
  featureUpdated: (evaluator: FeatureEvaluator, updatedAt: number) => void;
  /** Emitted when the layer is deleted. */
  featureRemoved: (params: FeatureRemovedParams) => void;
  featureVisibilityChanged: (params: FeatureVisibilityChangedParams) => void;
  deleted: () => void;
};

/**
 * Callback function type for feature evaluator operations.
 */
export type FeatureEvaluatorCallback = (evaluator: FeatureEvaluator) => void;

/**
 * A handle to control a resource layer (e.g., imagery, terrain, GeoJSON, 3D Tiles) after it has been added to the scene.
 * Returned by `ThreeView.addLayer()` when adding resource layers (not mesh, light, or effect layers).
 *
 * Resource layers are data-driven layers that load and display geographic data from external sources.
 * Use this handle to update layer configuration or delete the layer.
 *
 * @example
 * ```typescript
 * // Add a GeoJSON layer
 * const geoJsonLayer = view.addLayer({
 *   type: "geojson",
 *   data: {
 *     url: "https://example.com/data.geojson",
 *   },
 *   point: { color: 0xff0000 }
 * });
 *
 * // Update the layer configuration
 * geoJsonLayer.update({ point: { color: 0x00ff00 } });
 *
 * // Listen to feature events
 * geoJsonLayer.on("featureCreated", (evaluator) => {
 *   console.log("Feature created:", evaluator);
 * });
 *
 * // Delete the layer
 * geoJsonLayer.delete();
 * ```
 */
export class Layer extends EventHandler<LayerEvent> {
  /** The unique identifier of this layer. */
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
      this.emit("featureUpdated", evaluator, updatedAt);
    }

    return true;
  }

  /**
   * Marks the layer for update on the next frame.
   * Call this when you need to trigger `featureUpdated` events.
   */
  forceUpdate() {
    this.needUpdate = true;
  }

  /**
   * Updates the layer configuration.
   * The entire configuration is replaced with the new values.
   * @param l - New layer configuration
   */
  update(l: LayerDescription) {
    // Convert Color objects to numbers if converter is provided
    const processedLayer = this.convertColors
      ? (this.convertColors(l) as LayerDescription)
      : l;
    this.core.updateLayer(this.id, processedLayer);
  }

  /**
   * Removes the layer from the scene and disposes its resources.
   * Emits the "deleted" event before cleanup.
   * After calling this, the layer should no longer be used.
   */
  delete() {
    this.core.deleteLayer(this.id);
    this.emit("deleted");
  }
}
