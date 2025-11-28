import type { EventHandler, FeatureId } from "@navara/core";
import {
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  type Object3D,
} from "three";

import type { ViewEvents } from "..";
import {
  applyEmissiveEffect,
  type EmissiveParams,
  updatePostEffectLinksForObject,
} from "../core/SelectiveEffectRegistry";
import type { ViewContext } from "../core/ViewContext";
import { FeatureEvaluator } from "../evaluations";
import { Layer } from "../layer";
import { LayersManager } from "../layersManager";
import { ModelMesh } from "../mesh/model";

import type { FeatureHandler } from ".";

type ResolvedEffectPayload = {
  effectIds?: string[];
  emissiveIntensity?: number;
  emissiveColor?: number;
  postEffectOcclusion?: boolean;
};

const resolveEffectPayload = (
  viewContext: ViewContext,
  layerId: string,
): ResolvedEffectPayload | undefined => {
  const effectIds = viewContext.getLayerEffects(layerId);
  const postEffectOcclusion = viewContext.getLayerPostEffectOcclusion(layerId);
  const emissiveIntensity = viewContext.getLayerEmissiveIntensity(layerId);
  const emissiveColor = viewContext.getLayerEmissiveColor(layerId);

  if (
    (!effectIds || effectIds.length === 0) &&
    emissiveColor === undefined &&
    emissiveIntensity === undefined &&
    postEffectOcclusion === undefined
  ) {
    return undefined;
  }

  return {
    effectIds: effectIds ?? undefined,
    emissiveIntensity,
    emissiveColor: emissiveColor ?? undefined,
    postEffectOcclusion,
  };
};

const applyEmissiveToMeshMaterials = (
  obj: Object3D,
  effectPayload: ResolvedEffectPayload,
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
      if (!hasEffects) {
        // effectIds が空の場合は emissive を無効化
        material.emissiveIntensity = 0;
      } else {
        applyEmissiveEffect(material, {
          emissiveIntensity,
          emissiveColor: emissiveColor ?? undefined,
        } satisfies EmissiveParams);
      }
    }
  }
};

export const applyEffectPayloadToObject = (
  obj: Object3D,
  viewContext: ViewContext,
  layerId: string,
) => {
  const effectPayload = resolveEffectPayload(viewContext, layerId);
  if (!effectPayload) return;

  // Store effect state in userData for future shader-based rendering
  obj.userData.effectState = effectPayload;

  const nextEffects = effectPayload.effectIds;
  const prevEffectsRaw = obj.userData.layerEffects;
  const prevEffects: string[] =
    Array.isArray(prevEffectsRaw) &&
    prevEffectsRaw.every((id): id is string => typeof id === "string")
      ? prevEffectsRaw
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
        effectIds: nextEffects,
        emissiveIntensity,
        layerId,
        prevEffectIds: prevEffects,
      });
    } else if (viewContext.postEffectRegistry) {
      // Regular Mesh: PostEffectRegistry のユーティリティを使って link/unlink し、
      // emissive も共通ロジックで更新する。
      updatePostEffectLinksForObject(
        obj,
        viewContext.postEffectRegistry,
        nextEffects,
        prevEffects,
        layerId,
      );

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

  // Register Post Effect Occlusion if specified
  if (effectPayload.postEffectOcclusion !== undefined) {
    if (nextEffects && nextEffects.length > 0) {
      viewContext.postEffectRegistry?.registerLayerPostEffectOcclusion(
        layerId,
        effectPayload.postEffectOcclusion,
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
) => {
  const layer = layersManager.get(layerId);

  // Create the evaluator
  const evaluator = new FeatureEvaluator(handler, featureId, obj);

  // Register the feature evaluator with the layer if it exists
  if (layer && layer instanceof Layer) {
    layer._registerFeatureEvaluator(featureId, evaluator);
  }

  applyEffectPayloadToObject(obj, viewContext, layerId);

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
