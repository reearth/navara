import type { EventHandler } from "@navara/core";
import { type Object3D } from "three";

import type { FeatureId, ViewEvents } from "..";
import { FeatureEvaluator } from "../evaluations";

import type { FeatureHandler } from ".";

export const handleFeatureCreatedEventByLayerId = (
  handler: FeatureHandler,
  obj: Object3D,
  viewEvents: EventHandler<ViewEvents>,
  layerId: string,
  featureId: FeatureId,
) => {
  const evaluator = new FeatureEvaluator(handler, featureId, obj);
  viewEvents.emit("layer", "featureCreated", layerId, evaluator);
};

export const handleFeatureUpdatedEventByLayerId = (
  handler: FeatureHandler,
  obj: Object3D,
  viewEvents: EventHandler<ViewEvents>,
  layerId: string,
  featureId: FeatureId,
  updatedAt: number,
) => {
  const evaluator = new FeatureEvaluator(handler, featureId, obj);
  viewEvents.emit("layer", "featureUpdated", layerId, evaluator, updatedAt);
};
