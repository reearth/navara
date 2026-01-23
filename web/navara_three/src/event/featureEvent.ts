import type { EventHandler, FeatureId } from "@navara/core";
import type { Object3D } from "three";

import { ModelMesh, type ViewEvents } from "..";
import { FeatureEvaluator } from "../evaluations";
import { Layer } from "../layer";
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
  if (layer && layer instanceof Layer) {
    layer._registerFeatureEvaluator(featureId, evaluator);
  }

  let credit = undefined;
  if (obj instanceof ModelMesh) {
    const userData = obj.children[0].userData as { credit?: string };
    if (userData.credit) {
      credit = userData.credit;
    }
  }

  // Emit the evaluator
  viewEvents.emit("layer", "featureCreated", layerId, {
    id: featureId,
    evaluator,
    credit,
  });

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
  if (!(layer instanceof Layer)) return;
  const evaluator = layer._getFeatureEvaluator(featureId);
  if (!evaluator) return;

  // Emit the event with the evaluator
  viewEvents.emit("layer", "featureUpdated", layerId, evaluator, updatedAt);
};

export const handleFeatureVisibilityChangedEventByLayerId = (
  layersManager: LayersManager,
  layerId: string,
  featureId: FeatureId,
  visible: boolean,
) => {
  const layer = layersManager.get(layerId);

  if (!layer) return;
  if (!(layer instanceof Layer)) return;

  // Emit the visibility changed event
  layer.emit("featureVisibilityChanged", { id: featureId, visible });
};
