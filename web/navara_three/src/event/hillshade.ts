import { generate_id_from_entity } from "@navara/core";
import type { HillshadeBackfilledEvent } from "@navara/engine";
import {
  DataTexture,
  NearestFilter,
  NoColorSpace,
  RGBAFormat,
  Texture,
  UnsignedByteType,
} from "three";

import type { TileMesh } from "../mesh/tile";
import type { RasterTileInternalMaterial } from "@navara/engine";
import type { TextureOptions } from "../textures";
import type { BufferLoader } from "./index";
import {
  getTextureFragmentSlots,
  type TextureSlot,
} from "../utils/textureFragmentIndex";

/**
 * Rebind textures for a TileMesh by calling its setupTextures method
 * This ensures texture updates go through the standard texture management system
 * instead of directly modifying material.userData
 */
function rebindTexturesForTileMesh(
  tileMesh: TileMesh,
  loadedTexs: Map<string, Texture>,
  textureOptions: TextureOptions,
) {
  const material = tileMesh.material;
  if (!material || !material.userData) return;

  // Get material data to pass to setupTextures
  const maxTextures = tileMesh.maxTextures;

  // Create a minimal material object with the required fields
  const materialData: Partial<RasterTileInternalMaterial> = {
    tileZoomLevels: material.userData.hillshadeZooms?.value,
    isElevationHeatmaps: material.userData.isElevationHeatmaps?.value,
    isHillshades: material.userData.isHillshades?.value,
  };

  // Call setupTextures to properly bind textures through standard flow
  tileMesh.setupTextures(loadedTexs, textureOptions, maxTextures, materialData);
}

export function processHillshadeBackfilled(
  event: HillshadeBackfilledEvent | undefined,
  buf: BufferLoader,
  loadedTexs: Map<string, Texture>,
  textureFragmentIndex: Map<string, Set<TextureSlot>>,
  textureOptions: TextureOptions,
) {
  if (!event) return;

  // Use target_entity if provided (edge updates), otherwise use event entity (initialization)
  const entityId =
    event.target_entity_ind !== 0 || event.target_entity_gen !== 0
      ? `${event.target_entity_ind}_${event.target_entity_gen}`
      : generate_id_from_entity(event);

  let texture = loadedTexs.get(entityId);

  // 1. Create texture if original data is provided
  if (event.original_handle >= 0) {
    const originalBytes = buf.u8(event.original_handle);
    if (!originalBytes) {
      return;
    }

    // Validate buffer format (must be RGBA)
    if (originalBytes.length % 4 !== 0) {
      return;
    }

    const originalSize = Math.sqrt(originalBytes.length / 4);
    if (!Number.isInteger(originalSize) || originalSize < 1) {
      return;
    }

    // Expand to padded size (originalSize + 2 for 1px padding on each side)
    const paddedSize = originalSize + 2;
    const paddedBytes = new Uint8Array(paddedSize * paddedSize * 4);

    // Copy center content from original data
    for (let y = 0; y < originalSize; y++) {
      for (let x = 0; x < originalSize; x++) {
        const srcIdx = (y * originalSize + x) * 4;
        const dstIdx = ((y + 1) * paddedSize + (x + 1)) * 4;
        paddedBytes[dstIdx] = originalBytes[srcIdx];
        paddedBytes[dstIdx + 1] = originalBytes[srcIdx + 1];
        paddedBytes[dstIdx + 2] = originalBytes[srcIdx + 2];
        paddedBytes[dstIdx + 3] = originalBytes[srcIdx + 3];
      }
    }

    // Initialize padding with edge replication (will be updated by neighbor edges later)
    replicateEdgesToPadding(paddedBytes, paddedSize);

    // Create DataTexture with padded size
    const dataTexture = new DataTexture(
      paddedBytes,
      paddedSize,
      paddedSize,
      RGBAFormat,
      UnsignedByteType,
    );
    dataTexture.colorSpace = NoColorSpace;
    dataTexture.minFilter = NearestFilter;
    dataTexture.magFilter = NearestFilter;
    dataTexture.generateMipmaps = false;
    dataTexture.flipY = true;
    dataTexture.needsUpdate = true;

    // Dispose old texture if exists
    if (texture) {
      texture.dispose();
    }

    texture = dataTexture;
    loadedTexs.set(entityId, texture);

    const slots = getTextureFragmentSlots(textureFragmentIndex, entityId);
    if (slots) {
      for (const { tileMesh } of slots) {
        rebindTexturesForTileMesh(tileMesh, loadedTexs, textureOptions);
      }
    }
  }

  // 2. Update edges if edge data is provided
  if (event.edge_data_handle >= 0) {
    const edgeBytes = buf.removeU8(event.edge_data_handle);
    if (!edgeBytes) {
      return;
    }

    if (!texture || !(texture instanceof DataTexture)) {
      // Silently skip - this can happen if neighbor hasn't loaded yet
      return;
    }

    // Validate edge data: one edge (size pixels × 4 bytes RGBA)
    if (edgeBytes.length % 4 !== 0) {
      return;
    }

    const edgeSize = edgeBytes.length / 4; // Number of pixels in this edge
    const textureData = texture.image.data as Uint8Array;
    const texSize = texture.image.width;

    // Texture should be padded (edgeSize + 2)
    const expectedTexSize = edgeSize + 2;
    if (texSize !== expectedTexSize) {
      // Silently skip - different zoom levels have different texture sizes
      // Example: 258×258 tile receiving edge from 66×66 neighbor
      return;
    }

    // Update the specific padding edge based on direction
    // 0=Left, 1=Right, 2=Top, 3=Bottom
    updatePaddingEdge(textureData, edgeBytes, texSize, event.edge_direction);
    texture.needsUpdate = true;
  }
}

/**
 * Update a padding edge of a padded texture from neighbor edge data
 * @param textureData - The Uint8Array backing the DataTexture (paddedSize×paddedSize×4 bytes)
 * @param edgeBytes - Buffer containing one edge from neighbor (contentSize pixels × 4 bytes RGBA)
 * @param paddedSize - Padded texture size (e.g., 258 for 256×256 content)
 * @param direction - Edge direction: 0=Left, 1=Right, 2=Top, 3=Bottom
 * @internal Exported for testing only
 */
export function updatePaddingEdge(
  textureData: Uint8Array,
  edgeBytes: Uint8Array,
  paddedSize: number,
  direction: number,
): void {
  const contentSize = paddedSize - 2;

  switch (direction) {
    case 0: // Left padding (x=0)
      for (let y = 0; y < contentSize; y++) {
        const srcIdx = y * 4;
        const dstY = y + 1; // Content starts at y=1
        const dstIdx = (dstY * paddedSize + 0) * 4;
        textureData.set(edgeBytes.subarray(srcIdx, srcIdx + 4), dstIdx);
      }
      break;

    case 1: // Right padding (x=paddedSize-1)
      for (let y = 0; y < contentSize; y++) {
        const srcIdx = y * 4;
        const dstY = y + 1;
        const dstX = paddedSize - 1;
        const dstIdx = (dstY * paddedSize + dstX) * 4;
        textureData.set(edgeBytes.subarray(srcIdx, srcIdx + 4), dstIdx);
      }
      break;

    case 2: // Top padding (y=0)
      for (let x = 0; x < contentSize; x++) {
        const srcIdx = x * 4;
        const dstX = x + 1; // Content starts at x=1
        const dstIdx = (0 * paddedSize + dstX) * 4;
        textureData.set(edgeBytes.subarray(srcIdx, srcIdx + 4), dstIdx);
      }
      break;

    case 3: // Bottom padding (y=paddedSize-1)
      for (let x = 0; x < contentSize; x++) {
        const srcIdx = x * 4;
        const dstX = x + 1;
        const dstY = paddedSize - 1;
        const dstIdx = (dstY * paddedSize + dstX) * 4;
        textureData.set(edgeBytes.subarray(srcIdx, srcIdx + 4), dstIdx);
      }
      break;
  }
}

/**
 * Initialize padding by replicating content edges
 * @param paddedBytes - Padded texture data (paddedSize×paddedSize×4 bytes)
 * @param paddedSize - Padded texture size (e.g., 258)
 * @internal Exported for testing only
 */
export function replicateEdgesToPadding(
  paddedBytes: Uint8Array,
  paddedSize: number,
): void {
  const contentSize = paddedSize - 2;

  // Top padding (y=0): copy from first content row (y=1)
  for (let x = 1; x <= contentSize; x++) {
    const srcIdx = (1 * paddedSize + x) * 4;
    const dstIdx = (0 * paddedSize + x) * 4;
    paddedBytes[dstIdx] = paddedBytes[srcIdx];
    paddedBytes[dstIdx + 1] = paddedBytes[srcIdx + 1];
    paddedBytes[dstIdx + 2] = paddedBytes[srcIdx + 2];
    paddedBytes[dstIdx + 3] = paddedBytes[srcIdx + 3];
  }

  // Bottom padding (y=paddedSize-1): copy from last content row (y=contentSize)
  for (let x = 1; x <= contentSize; x++) {
    const srcIdx = (contentSize * paddedSize + x) * 4;
    const dstIdx = ((paddedSize - 1) * paddedSize + x) * 4;
    paddedBytes[dstIdx] = paddedBytes[srcIdx];
    paddedBytes[dstIdx + 1] = paddedBytes[srcIdx + 1];
    paddedBytes[dstIdx + 2] = paddedBytes[srcIdx + 2];
    paddedBytes[dstIdx + 3] = paddedBytes[srcIdx + 3];
  }

  // Left padding (x=0): copy from first content column (x=1)
  for (let y = 1; y <= contentSize; y++) {
    const srcIdx = (y * paddedSize + 1) * 4;
    const dstIdx = (y * paddedSize + 0) * 4;
    paddedBytes[dstIdx] = paddedBytes[srcIdx];
    paddedBytes[dstIdx + 1] = paddedBytes[srcIdx + 1];
    paddedBytes[dstIdx + 2] = paddedBytes[srcIdx + 2];
    paddedBytes[dstIdx + 3] = paddedBytes[srcIdx + 3];
  }

  // Right padding (x=paddedSize-1): copy from last content column (x=contentSize)
  for (let y = 1; y <= contentSize; y++) {
    const srcIdx = (y * paddedSize + contentSize) * 4;
    const dstIdx = (y * paddedSize + (paddedSize - 1)) * 4;
    paddedBytes[dstIdx] = paddedBytes[srcIdx];
    paddedBytes[dstIdx + 1] = paddedBytes[srcIdx + 1];
    paddedBytes[dstIdx + 2] = paddedBytes[srcIdx + 2];
    paddedBytes[dstIdx + 3] = paddedBytes[srcIdx + 3];
  }

  // Corners: copy from adjacent content pixels
  // Top-left (0, 0)
  const tlSrcIdx = (1 * paddedSize + 1) * 4;
  const tlDstIdx = 0;
  paddedBytes[tlDstIdx] = paddedBytes[tlSrcIdx];
  paddedBytes[tlDstIdx + 1] = paddedBytes[tlSrcIdx + 1];
  paddedBytes[tlDstIdx + 2] = paddedBytes[tlSrcIdx + 2];
  paddedBytes[tlDstIdx + 3] = paddedBytes[tlSrcIdx + 3];

  // Top-right (paddedSize-1, 0)
  const trSrcIdx = (1 * paddedSize + contentSize) * 4;
  const trDstIdx = (paddedSize - 1) * 4;
  paddedBytes[trDstIdx] = paddedBytes[trSrcIdx];
  paddedBytes[trDstIdx + 1] = paddedBytes[trSrcIdx + 1];
  paddedBytes[trDstIdx + 2] = paddedBytes[trSrcIdx + 2];
  paddedBytes[trDstIdx + 3] = paddedBytes[trSrcIdx + 3];

  // Bottom-left (0, paddedSize-1)
  const blSrcIdx = (contentSize * paddedSize + 1) * 4;
  const blDstIdx = (paddedSize - 1) * paddedSize * 4;
  paddedBytes[blDstIdx] = paddedBytes[blSrcIdx];
  paddedBytes[blDstIdx + 1] = paddedBytes[blSrcIdx + 1];
  paddedBytes[blDstIdx + 2] = paddedBytes[blSrcIdx + 2];
  paddedBytes[blDstIdx + 3] = paddedBytes[blSrcIdx + 3];

  // Bottom-right (paddedSize-1, paddedSize-1)
  const brSrcIdx = (contentSize * paddedSize + contentSize) * 4;
  const brDstIdx = ((paddedSize - 1) * paddedSize + (paddedSize - 1)) * 4;
  paddedBytes[brDstIdx] = paddedBytes[brSrcIdx];
  paddedBytes[brDstIdx + 1] = paddedBytes[brSrcIdx + 1];
  paddedBytes[brDstIdx + 2] = paddedBytes[brSrcIdx + 2];
  paddedBytes[brDstIdx + 3] = paddedBytes[brSrcIdx + 3];
}
