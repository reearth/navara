import type { EventHandler, FeatureId } from "@navara/core";
import {
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  type Object3D,
} from "three";

import type { ViewEvents } from "..";
import type { ViewContext } from "../core/ViewContext";
import { FeatureEvaluator } from "../evaluations";
import { Layer } from "../layer";
import { LayersManager } from "../layersManager";
import { ModelMesh } from "../mesh/model";

import type { FeatureHandler } from ".";

export const handleFeatureCreatedEventByLayerId = (
  handler: FeatureHandler,
  obj: Object3D,
  viewEvents: EventHandler<ViewEvents>,
  layersManager: LayersManager,
  viewContext: ViewContext,
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

  // Link to selective effects if specified
  const effects = viewContext.getLayerEffects(layerId);
  if (effects && effects.length > 0 && viewContext.selectiveRegistry) {
    // Update world matrix before linking (required for proper cloning)
    obj.updateMatrixWorld(true);

    // ModelMesh handles effects via events
    if (obj instanceof ModelMesh) {
      const emissiveIntensity = viewContext.getLayerEmissiveIntensity(layerId);
      obj.dispatchEvent({
        type: "layerEffectsChanged",
        target: obj,
        effects,
        emissiveIntensity,
        layerId,
        prevEffects: [], // Initial creation has no previous effects
      });
    } else {
      // For other mesh types, link directly
      for (const effectId of effects) {
        viewContext.selectiveRegistry.link(effectId, obj, layerId);
      }

      // Apply emissive for non-ModelMesh types
      if (obj instanceof Mesh) {
        const materials = Array.isArray(obj.material)
          ? obj.material
          : [obj.material];

        for (const material of materials) {
          if (
            material instanceof MeshStandardMaterial ||
            material instanceof MeshPhysicalMaterial
          ) {
            material.emissive.copy(material.color);
            material.emissiveIntensity =
              viewContext.getLayerEmissiveIntensity(layerId);
          }
        }
      }
    }
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
  if (!(layer instanceof Layer)) return;
  const evaluator = layer._getFeatureEvaluator(featureId);
  if (!evaluator) return;

  // Emit the event with the evaluator
  viewEvents.emit("layer", "featureUpdated", layerId, evaluator, updatedAt);
};
