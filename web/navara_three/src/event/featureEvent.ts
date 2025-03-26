import type { EventHandler } from "@navara/core";
import { type Object3D } from "three";

import type { ViewEvents } from "..";

export const handleFeatureCreatedEventByLayerId = (
  obj: Object3D,
  viewEvents: EventHandler<ViewEvents>,
  layerId: string,
) => {
  viewEvents.emit("layer", "featureCreated", layerId, obj);
};

export const handleFeatureUpdatedEventByLayerId = (
  obj: Object3D,
  viewEvents: EventHandler<ViewEvents>,
  layerId: string,
  updatedAt: number,
) => {
  viewEvents.emit("layer", "featureUpdated", layerId, obj, updatedAt);
};
