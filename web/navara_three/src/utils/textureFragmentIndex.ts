/**
 * Reverse index for efficient texture fragment → tile mesh lookups
 * Optimizes hillshade backfill updates from O(numTiles × numLayers) to O(1)
 */

import type { TileMesh } from "../mesh/tile";

export interface TextureSlot {
  tileMesh: TileMesh;
  slotIndex: number;
}

/**
 * Global reverse index: texture fragment id → Set of {tileMesh, slotIndex}
 * Updated when TileMesh.setupTextureFragments is called
 */
const textureFragmentIndex = new Map<string, Set<TextureSlot>>();

/**
 * Update the index when a tile's textureFragments change
 * Call this from TileMesh.setupTextureFragments()
 */
export function updateTextureFragmentIndex(
  tileMesh: TileMesh,
  textureFragmentIds: (string | null)[],
): void {
  // Remove this tileMesh from all previous entries
  removeTextureFragmentIndex(tileMesh);

  // Add this tileMesh to new entries
  for (let slotIndex = 0; slotIndex < textureFragmentIds.length; slotIndex++) {
    const fragmentId = textureFragmentIds[slotIndex];
    if (!fragmentId) continue;

    let slots = textureFragmentIndex.get(fragmentId);
    if (!slots) {
      slots = new Set();
      textureFragmentIndex.set(fragmentId, slots);
    }
    slots.add({ tileMesh, slotIndex });
  }
}

/**
 * Remove a tileMesh from the index (called when tile is disposed or updated)
 */
export function removeTextureFragmentIndex(tileMesh: TileMesh): void {
  // Iterate through all entries and remove references to this tileMesh
  for (const [fragmentId, slots] of textureFragmentIndex.entries()) {
    for (const slot of slots) {
      if (slot.tileMesh === tileMesh) {
        slots.delete(slot);
      }
    }
    // Clean up empty entries
    if (slots.size === 0) {
      textureFragmentIndex.delete(fragmentId);
    }
  }
}

/**
 * Get all tile meshes and slot indices that use a specific texture fragment
 * Returns undefined if no tiles use this fragment
 */
export function getTextureFragmentSlots(
  fragmentId: string,
): Set<TextureSlot> | undefined {
  return textureFragmentIndex.get(fragmentId);
}
