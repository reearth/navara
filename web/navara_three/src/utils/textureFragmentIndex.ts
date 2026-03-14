/**
 * Reverse index for efficient texture fragment → tile mesh lookups
 * Optimizes hillshade backfill updates from O(numTiles × numLayers) to O(affectedTiles)
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
 * Bidirectional index: tileMesh → Set of fragment IDs it uses
 * Enables O(numLayersForTile) removal instead of O(total indexed slots)
 */
const tileMeshToFragmentIds = new Map<TileMesh, Set<string>>();

/**
 * Update the index when a tile's textureFragments change
 * Call this from TileMesh.setupTextureFragments()
 * Complexity: O(numLayersForTile)
 */
export function updateTextureFragmentIndex(
  tileMesh: TileMesh,
  textureFragmentIds: (string | null)[],
): void {
  // Remove this tileMesh from all previous entries
  removeTextureFragmentIndex(tileMesh);

  const newFragmentIds = new Set<string>();

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
    newFragmentIds.add(fragmentId);
  }

  // Update bidirectional index
  if (newFragmentIds.size > 0) {
    tileMeshToFragmentIds.set(tileMesh, newFragmentIds);
  }
}

/**
 * Remove a tileMesh from the index (called when tile is disposed or updated)
 * Complexity: O(numLayersForTile)
 */
export function removeTextureFragmentIndex(tileMesh: TileMesh): void {
  // Use bidirectional index for fast lookup
  const fragmentIds = tileMeshToFragmentIds.get(tileMesh);
  if (!fragmentIds) return;

  // Remove this tileMesh from each fragmentId it uses
  for (const fragmentId of fragmentIds) {
    const slots = textureFragmentIndex.get(fragmentId);
    if (!slots) continue;

    // Remove all slots belonging to this tileMesh
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

  // Remove from bidirectional index
  tileMeshToFragmentIds.delete(tileMesh);
}

/**
 * Get all tile meshes and slot indices that use a specific texture fragment
 * Returns undefined if no tiles use this fragment
 * Returns the internal Set typed as ReadonlySet.
 * This provides compile-time protection only; callers must not mutate it.
 */
export function getTextureFragmentSlots(
  fragmentId: string,
): ReadonlySet<TextureSlot> | undefined {
  return textureFragmentIndex.get(fragmentId);
}

export function __resetTextureFragmentIndexForTests(): void {
  textureFragmentIndex.clear();
  tileMeshToFragmentIds.clear();
}
