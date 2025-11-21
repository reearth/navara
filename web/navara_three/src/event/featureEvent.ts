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

export type FeatureEffectPayload = {
  effectIds?: string[];
  emissiveIntensity?: number;
  emissiveColor?: number;
  selectiveDepthTest?: boolean;
};

const resolveEffectPayload = (
  viewContext: ViewContext,
  layerId: string,
  payload?: FeatureEffectPayload,
): FeatureEffectPayload | undefined => {
  if (payload) {
    return payload;
  }

  const effectIds = viewContext.getLayerEffects(layerId);
  const selectiveDepthTest = viewContext.getLayerSelectiveDepthTest(layerId);
  const emissiveIntensity = viewContext.getLayerEmissiveIntensity(layerId);
  const emissiveColor = viewContext.getLayerEmissiveColor(layerId);

  if (
    (!effectIds || effectIds.length === 0) &&
    emissiveColor === undefined &&
    emissiveIntensity === undefined &&
    selectiveDepthTest === undefined
  ) {
    return undefined;
  }

  return {
    effectIds: effectIds ?? undefined,
    emissiveIntensity,
    emissiveColor: emissiveColor ?? undefined,
    selectiveDepthTest,
  };
};

/**
 * Apply emissive properties to mesh materials.
 * This is the ONLY place where materials are directly manipulated for layer effects.
 *
 * This function consolidates material manipulation logic to facilitate future migration
 * to shader-based emissive rendering.
 *
 * TODO: Future enhancement - migrate to shader-based emissive rendering
 * to eliminate direct material manipulation entirely.
 */
const applyEmissiveToMeshMaterials = (
  obj: Object3D,
  effectPayload: FeatureEffectPayload,
  viewContext: ViewContext,
  layerId: string,
): void => {
  if (!(obj instanceof Mesh)) return;

  const emissiveIntensity =
    effectPayload.emissiveIntensity ??
    viewContext.getLayerEmissiveIntensity(layerId);
  const emissiveColor =
    effectPayload.emissiveColor ?? viewContext.getLayerEmissiveColor(layerId);
  const hasEffects =
    effectPayload.effectIds && effectPayload.effectIds.length > 0;

  const materials = Array.isArray(obj.material) ? obj.material : [obj.material];

  for (const material of materials) {
    if (
      material instanceof MeshStandardMaterial ||
      material instanceof MeshPhysicalMaterial
    ) {
      if (hasEffects) {
        material.emissive.set(
          emissiveColor !== undefined ? emissiveColor : material.color,
        );
        material.emissiveIntensity = emissiveIntensity;
      } else {
        material.emissiveIntensity = 0;
      }
    }
  }
};

export const applyEffectPayloadToObject = (
  obj: Object3D,
  viewContext: ViewContext,
  layerId: string,
  payload?: FeatureEffectPayload,
) => {
  const effectPayload = resolveEffectPayload(viewContext, layerId, payload);
  if (!effectPayload) return;

  // Store effect state in userData for future shader-based rendering
  obj.userData.effectState = effectPayload;

  const nextEffects = effectPayload.effectIds;
  const prevEffects: string[] = Array.isArray(obj.userData.layerEffects)
    ? (obj.userData.layerEffects as string[])
    : [];

  const emissiveIntensity =
    effectPayload.emissiveIntensity ??
    viewContext.getLayerEmissiveIntensity(layerId);
  const emissiveColor =
    effectPayload.emissiveColor ?? viewContext.getLayerEmissiveColor(layerId);

  if (nextEffects) {
    obj.userData.layerEffects = [...nextEffects];
    if (obj instanceof ModelMesh) {
      // ModelMesh: Use event-based updates
      obj.dispatchEvent({
        type: "layerEffectsChanged",
        target: obj,
        effects: nextEffects,
        emissiveIntensity,
        layerId,
        prevEffects,
      });
    } else if (viewContext.selectiveRegistry) {
      // Regular Mesh: Direct selective registry management + material updates

      // 1. Unlink removed effects from selective registry
      for (const effectId of prevEffects) {
        if (!nextEffects.includes(effectId)) {
          viewContext.selectiveRegistry.unlink(effectId, obj);
        }
      }

      // 2. Update matrix if any new effects need linking
      const needsLink = nextEffects.some(
        (effectId) => !prevEffects.includes(effectId),
      );
      if (needsLink) {
        obj.updateMatrixWorld(true);
      }

      // 3. Link new effects to selective registry
      for (const effectId of nextEffects) {
        if (!prevEffects.includes(effectId)) {
          viewContext.selectiveRegistry.link(effectId, obj, layerId);
        }
      }

      // 4. Apply emissive material updates (consolidated in helper function)
      applyEmissiveToMeshMaterials(obj, effectPayload, viewContext, layerId);
    }
  }

  // ModelMesh: Dispatch emissive event
  if (obj instanceof ModelMesh) {
    obj.dispatchEvent({
      type: "emissive",
      target: obj,
      emissiveIntensity,
      emissiveColor,
      layerId,
    });
  }

  // Register selective depth test if specified
  if (effectPayload.selectiveDepthTest !== undefined) {
    if (nextEffects && nextEffects.length > 0) {
      viewContext.selectiveRegistry?.registerLayerSelectiveDepthTest(
        layerId,
        effectPayload.selectiveDepthTest,
      );
    }
  }
};

export const handleFeatureCreatedEventByLayerId = (
  handler: FeatureHandler,
  obj: Object3D,
  viewEvents: EventHandler<ViewEvents>,
  layersManager: LayersManager,
  viewContext: ViewContext,
  layerId: string,
  featureId: FeatureId,
  effectPayload?: FeatureEffectPayload,
) => {
  const layer = layersManager.get(layerId);

  // Create the evaluator
  const evaluator = new FeatureEvaluator(handler, featureId, obj);

  // Register the feature evaluator with the layer if it exists
  if (layer && layer instanceof Layer) {
    layer._registerFeatureEvaluator(featureId, evaluator);
  }

  applyEffectPayloadToObject(obj, viewContext, layerId, effectPayload);

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
