import type { EventHandler, FeatureId } from "@navara/core";
import type { Object3D } from "three";

import type { ViewEvents } from "..";
import {
  applyEmissiveToObject3D,
  updatePostEffectLinksForObject,
  type PostEffectConfig,
} from "../core/PostEffectHelper";
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
  postEffectOcclusion?: number;
};

const resolveEffectPayload = (
  viewContext: ViewContext,
  layerId: string,
): ResolvedEffectPayload | undefined => {
  const effectIds = viewContext.getLayerEffects(layerId);
  const postEffectOcclusion = viewContext.getLayerPostEffectOcclusion(layerId);
  const emissiveIntensity = viewContext.getLayerEmissiveIntensity(layerId);
  const emissiveColor = viewContext.getLayerEmissiveColor(layerId);

  // If effectIds is empty, treat post effects as disabled and return undefined
  // (even when postEffectOcclusion or emissive values are present)
  if (!effectIds || effectIds.length === 0) {
    return undefined;
  }

  return {
    effectIds: effectIds ?? undefined,
    emissiveIntensity,
    emissiveColor: emissiveColor ?? undefined,
    postEffectOcclusion,
  };
};

/**
 * Apply emissive effect to mesh materials using common helper
 */
const applyEmissiveToMeshMaterials = (
  obj: Object3D,
  effectPayload: ResolvedEffectPayload,
): void => {
  // effectPayload already contains emissiveIntensity from resolveEffectPayload
  applyEmissiveToObject3D(obj, {
    emissiveIntensity: effectPayload.emissiveIntensity ?? 0,
    emissiveColor: effectPayload.emissiveColor,
  });
};

/**
 * Synchronizes effect/style settings from ViewContext to Three.js Object3D.
 * This function is the bridge between Rust-managed styles and Three.js rendering.
 *
 * Called when:
 * - A feature is created (handleFeatureCreatedEventByLayerId)
 * - A feature's material properties change (processRenderableFeatureChanged)
 *
 * Note: While the Source of Truth for effects is Rust, this function is still
 * necessary to apply those effects to Three.js materials (emissive, registry links, etc.)
 *
 * For ModelMesh objects: Dispatches 'layerEffectsChanged' event
 * For Regular meshes: Directly updates PostEffectRegistry links and emissive materials
 */
export const applyEffectPayloadToObject = (
  obj: Object3D,
  viewContext: ViewContext,
  layerId: string,
) => {
  // Read prevEffects from userData first
  const prevEffectsRaw = obj.userData.postEffectConfig?.effectIds;
  const prevEffects: string[] = Array.isArray(prevEffectsRaw)
    ? prevEffectsRaw
    : [];

  const effectPayload = resolveEffectPayload(viewContext, layerId);

  // If effectPayload is undefined (no effectIds), still apply emissive
  // This ensures emissive works even without post effects (Bloom, etc.)
  if (!effectPayload) {
    const emissiveIntensity = viewContext.getLayerEmissiveIntensity(layerId);
    const emissiveColor = viewContext.getLayerEmissiveColor(layerId);

    // Apply emissive to object regardless of effectIds
    if (obj instanceof ModelMesh) {
      obj.dispatchEvent({
        type: "layerEffectsChanged",
        target: obj,
        effectIds: [],
        emissiveIntensity,
        emissiveColor,
        layerId,
        prevEffectIds: prevEffects,
      });
    } else {
      applyEmissiveToObject3D(obj, { emissiveIntensity, emissiveColor });
    }

    // Clear post effect links if any existed
    if (prevEffects.length > 0 && viewContext.postEffectRegistry) {
      updatePostEffectLinksForObject(
        obj,
        viewContext.postEffectRegistry,
        [], // Empty array → unlink all
        prevEffects,
        layerId,
      );
    }
    delete obj.userData.postEffectConfig;
    delete obj.userData.postEffectLayerId;
    return;
  }

  // Store PostEffectConfig for new rendering approach
  // Note: postEffectOcclusion is NOT stored - SoT is registry, accessed via layerId
  const config: PostEffectConfig = {
    effectIds: effectPayload.effectIds ?? [],
    emissiveIntensity: effectPayload.emissiveIntensity,
    emissiveColor: effectPayload.emissiveColor,
    layerId, // Store layerId for registry lookup (SoT access)
  };
  obj.userData.postEffectConfig = config;

  const nextEffects = effectPayload.effectIds;

  const emissiveIntensity =
    effectPayload.emissiveIntensity ??
    viewContext.getLayerEmissiveIntensity(layerId);
  const emissiveColor =
    effectPayload.emissiveColor ?? viewContext.getLayerEmissiveColor(layerId);

  // Always dispatch layerEffectsChanged for ModelMesh, or update for Regular Mesh
  // even if nextEffects is empty array (to handle Bloom Off case)
  if (obj instanceof ModelMesh) {
    // ModelMesh: Use event-based updates
    obj.dispatchEvent({
      type: "layerEffectsChanged",
      target: obj,
      effectIds: nextEffects ?? [],
      emissiveIntensity,
      emissiveColor,
      layerId,
      prevEffectIds: prevEffects,
    });
  } else if (viewContext.postEffectRegistry) {
    // Regular meshes: use PostEffectRegistry helpers to link/unlink
    // and update emissive via the shared logic
    if (nextEffects) {
      updatePostEffectLinksForObject(
        obj,
        viewContext.postEffectRegistry,
        nextEffects,
        prevEffects,
        layerId,
      );
    }

    // 4. Apply emissive material updates (consolidated in helper function)
    applyEmissiveToMeshMaterials(obj, effectPayload);
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
