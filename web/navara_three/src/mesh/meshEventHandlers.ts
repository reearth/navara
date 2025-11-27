import { Object3D } from "three";

import type { ViewContext } from "../core/ViewContext";
import { isEmissiveEvent, isLayerEffectsChangedEvent } from "../object3DEvent";

// Cache materials to avoid repeated traversals
type MaterialCache = {
  emissiveMaterials: {
    emissive: { copy: (color: unknown) => void; set: (color: number) => void };
    emissiveIntensity: number;
    color: unknown;
  }[];
  depthTestMaterials: { depthTest: boolean }[];
};

/**
 * Cache materials for a mesh object to avoid repeated traversals
 */
function cacheMaterials(mesh: Object3D): MaterialCache {
  const emissiveMaterials: MaterialCache["emissiveMaterials"] = [];
  const depthTestMaterials: MaterialCache["depthTestMaterials"] = [];

  mesh.traverse((obj) => {
    if ("material" in obj && obj.material) {
      const materials = Array.isArray(obj.material)
        ? obj.material
        : [obj.material];

      for (const material of materials) {
        // Cache materials with emissive property
        if (
          typeof material === "object" &&
          material !== null &&
          "emissive" in material &&
          "emissiveIntensity" in material &&
          "color" in material
        ) {
          emissiveMaterials.push(
            material as MaterialCache["emissiveMaterials"][number],
          );
        }

        // Cache materials with depthTest property
        if (
          typeof material === "object" &&
          material !== null &&
          "depthTest" in material
        ) {
          depthTestMaterials.push(
            material as MaterialCache["depthTestMaterials"][number],
          );
        }
      }
    }
  });

  return { emissiveMaterials, depthTestMaterials };
}

/**
 * Setup event handlers for mesh objects to enable event-driven effects control.
 * This function registers handlers for emissive and layerEffectsChanged events.
 *
 * @param mesh - The mesh object to setup handlers for
 * @param viewContext - The ViewContext instance for accessing SelectiveEffectRegistry
 * @param layerId - The layer ID associated with this mesh
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

  // Cache materials once to avoid repeated traversals
  const materialCache = cacheMaterials(mesh);

  // Handle emissive event
  addCustomEventListener(mesh, "emissive", (event) => {
    if (!isEmissiveEvent(event)) return;

    // Use cached materials instead of traversing
    for (const material of materialCache.emissiveMaterials) {
      // Use custom emissive color if provided, otherwise use material color
      if (event.emissiveColor !== undefined) {
        material.emissive.set(event.emissiveColor);
      } else {
        material.emissive.copy(material.color);
      }
      material.emissiveIntensity = event.emissiveIntensity;
    }
  });

  // Handle layerEffectsChanged event
  addCustomEventListener(mesh, "layerEffectsChanged", (event) => {
    if (!viewContext.selectiveRegistry) return;
    if (!isLayerEffectsChangedEvent(event)) return;

    const { prevEffectIds, effectIds } = event;

    // Unlink removed effects
    for (const effectId of prevEffectIds) {
      if (!effectIds.includes(effectId)) {
        viewContext.selectiveRegistry.unlink(effectId, mesh);
      }
    }

    // Update matrix world if needed for new effects
    const needsLink = effectIds.some(
      (effectIds) => !prevEffectIds.includes(effectIds),
    );
    if (needsLink) {
      mesh.updateMatrixWorld(true);
    }

    // Link added effects
    for (const effectId of effectIds) {
      if (!prevEffectIds.includes(effectId)) {
        viewContext.selectiveRegistry.link(effectId, mesh, layerId);
      }
    }
  });

  // Note: postEffectDepthTest should NOT modify original mesh materials
  // Original meshes should always have depthTest=true for main scene rendering
  // Only clones in SelectiveEffectRegistry should have their depthTest modified
  // This is handled directly in SelectiveEffectRegistry.link() and updateLayerpostEffectDepthTest()
}

/**
 * Helper function to add custom event listeners in a type-safe manner.
 */
function addCustomEventListener<T extends string>(
  obj: Object3D,
  type: T,
  listener: (event: unknown) => void,
): void {
  const addListener = obj.addEventListener.bind(obj);
  addListener(
    type as Parameters<typeof addListener>[0],
    listener as Parameters<typeof addListener>[1],
  );
}
