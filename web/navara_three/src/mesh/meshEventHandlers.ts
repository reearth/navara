import { Object3D } from "three";

import {
  applyEmissiveToObject3D,
  updatePostEffectLinksForObject,
} from "../core/PostEffectHelper";
import type { ViewContext } from "../core/ViewContext";
import { isLayerEffectsChangedEvent } from "../object3DEvent";

/**
 * Setup event handlers for mesh objects to enable event-driven effects control.
 */
export function setupMeshEventHandlers(
  mesh: Object3D,
  viewContext: ViewContext,
  layerId: string,
): void {
  // Type guard for objects with addEventListener
  const hasEventDispatcher =
    "addEventListener" in mesh && typeof mesh.addEventListener === "function";

  if (!hasEventDispatcher) return;

  // Handle layerEffectsChanged event
  // Cast required because Three.js addEventListener is typed for Object3DEventMap only
  (
    mesh.addEventListener as (
      type: string,
      listener: (e: unknown) => void,
    ) => void
  )("layerEffectsChanged", (event) => {
    if (!isLayerEffectsChangedEvent(event)) return;

    const { prevEffectIds, effectIds, emissiveIntensity, emissiveColor } =
      event;

    // Apply emissive unconditionally using common helper
    applyEmissiveToObject3D(mesh, { emissiveIntensity, emissiveColor });

    // Update PostEffectRegistry links
    updatePostEffectLinksForObject(
      mesh,
      viewContext.postEffectRegistry,
      effectIds,
      prevEffectIds,
      layerId,
    );
  });

  // Meshes render autonomously and adjust their own depth settings
  // via onBeforeRender callbacks based on the current render target.
  // No clones are used.
}
