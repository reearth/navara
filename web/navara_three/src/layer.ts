import { EventHandler, type FeatureSetId } from "@navara/core";
import type { Core } from "@navara/engine";

import { FeatureEvaluator } from "./evaluations";
import type { LayerDescription } from "./type";

export type FeatureCreatedParams = {
  featureSetId: FeatureSetId;
  evaluator: FeatureEvaluator;
  credit?: string;
};

export type FeatureUpdatedParams = {
  featureSetId: FeatureSetId;
  evaluator: FeatureEvaluator;
  updatedAt: number;
};

export type FeatureVisibilityChangedParams = {
  featureSetId: FeatureSetId;
  visible: boolean;
};

export type FeatureRemovedParams = {
  featureSetId: FeatureSetId;
};

/**
 * Events emitted by Layer. Subscribe using `layer.on(eventName, callback)`.
 */
export type LayerEvent = {
  /** Emitted when a new feature is created in this layer. */
  featureCreated: (params: FeatureCreatedParams) => void;
  /** Emitted when a feature in this layer is updated. */
  featureUpdated: (params: FeatureUpdatedParams) => void;
  /** Emitted when a feature's visibility changes. */
  featureVisibilityChanged: (params: FeatureVisibilityChangedParams) => void;
  /** Emitted when a feature is removed from this layer. */
  featureRemoved: (params: FeatureRemovedParams) => void;
  /** Emitted when the layer is deleted. */
  deleted: () => void;
};

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
 * geoJsonLayer.on("featureCreated", ({ evaluator }) => {
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
  private featureEvaluators: Map<FeatureSetId, FeatureEvaluator> = new Map<
    FeatureSetId,
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
  _registerFeatureEvaluator(
    featureSetId: FeatureSetId,
    evaluator: FeatureEvaluator,
  ) {
    this.featureEvaluators.set(featureSetId, evaluator);
  }

  /**
   * Get a feature evaluator by ID
   * @internal Used by the event system
   */
  _getFeatureEvaluator(
    featureSetId: FeatureSetId,
  ): FeatureEvaluator | undefined {
    return this.featureEvaluators.get(featureSetId);
  }

  /**
   * Unregister a feature evaluator from this layer
   * @internal Used by the event system
   */
  _unregisterFeatureEvaluator(featureSetId: FeatureSetId) {
    this.featureEvaluators.delete(featureSetId);
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
      this.emit("featureUpdated", {
        featureSetId: evaluator.id,
        evaluator,
        updatedAt,
      });
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
