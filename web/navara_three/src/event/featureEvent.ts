import type { EventHandler, FeatureId } from "@navara/core";
import { type Object3D } from "three";

import type { ViewEvents } from "..";
import { FeatureEvaluator } from "../evaluations";
import { LayersManager } from "../layersManager";

import type { FeatureHandler } from ".";

export const handleFeatureCreatedEventByLayerId = (
  handler: FeatureHandler,
  obj: Object3D,
  viewEvents: EventHandler<ViewEvents>,
  layersManager: LayersManager,
  layerId: string,
  featureId: FeatureId,
) => {
  const layer = layersManager.get(layerId);

  // Create the evaluator
  const evaluator = new FeatureEvaluator(handler, featureId, obj);

  // Register the feature evaluator with the layer if it exists
  if (layer) {
    layer._registerFeatureEvaluator(featureId, evaluator);
  }

  // Emit the evaluator
  viewEvents.emit("layer", "featureCreated", layerId, evaluator);

  return layer;
};

export const handleFeatureUpdatedEventByLayerId = (
  viewEvents: EventHandler<ViewEvents>,
  layersManager: LayersManager,
  layerId: string,
  featureId: FeatureId,
  updatedAt: number,
) => {
  const layer = layersManager.get(layerId);

  if (!layer) return;

  // Get the existing evaluator or create a new one
  const evaluator = layer._getFeatureEvaluator(featureId);
  if (!evaluator) return;

  // Emit the event with the evaluator
  viewEvents.emit("layer", "featureUpdated", layerId, evaluator, updatedAt);
};
