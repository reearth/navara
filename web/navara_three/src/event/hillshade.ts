import { generate_id_from_entity } from "@navara/core";
import type { HillshadeBackfilledEvent } from "@navara/engine";
import {
  DataTexture,
  NearestFilter,
  NoColorSpace,
  RGBAFormat,
  UnsignedByteType,
} from "three";

import type { TileMesh } from "../mesh/tile";
import { getTextureFragmentSlots } from "../utils/textureFragmentIndex";

import type { EventContext } from "./context";
import type { HillshadeContext } from "./HillshadeContext";

/**
 * Create padded DEM texture from original data
 * @returns DataTexture with padding, or undefined if invalid data
 */
function createPaddedDemTexture(
  originalBytes: Uint8Array,
): DataTexture | undefined {
  // Validate buffer format (must be RGBA)
  if (originalBytes.length % 4 !== 0) {
    return undefined;
  }

  const originalSize = Math.sqrt(originalBytes.length / 4);
  if (!Number.isInteger(originalSize) || originalSize < 1) {
    return undefined;
  }

  // Expand to padded size (originalSize + 2 for 1px padding on each side)
  const paddedSize = originalSize + 2;
  const paddedBytes = new Uint8Array(paddedSize * paddedSize * 4);

  // Copy center content from original data
  // Optimized: copy entire rows at once using Uint8Array.set (5-10× faster than per-pixel loop)
  const rowBytes = originalSize * 4; // RGBA bytes per row
  for (let y = 0; y < originalSize; y++) {
    const srcRowStart = y * rowBytes;
    const dstRowStart = (y + 1) * paddedSize * 4 + 4; // +1 row for top padding, +4 bytes for left padding
    paddedBytes.set(
      originalBytes.subarray(srcRowStart, srcRowStart + rowBytes),
      dstRowStart,
    );
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
  dataTexture.needsUpdate = true;

  return dataTexture;
}

/**
 * Apply pending edges that arrived before texture creation
 * @returns Array of successfully applied edge directions
 */
function applyPendingEdges(
  dataTexture: DataTexture,
  hillshadeContext: HillshadeContext,
  entityId: string,
): number[] {
  const appliedEdges: number[] = [];
  const pending = hillshadeContext.pendingEdges.get(entityId);

  if (!pending || pending.size === 0) {
    return appliedEdges;
  }

  const textureData = dataTexture.image.data as Uint8Array;
  const texSize = dataTexture.image.width;

  for (const [edgeDirection, edgeBytes] of pending) {
    const edgeSize = edgeBytes.length / 4;
    const expectedTexSize = edgeSize + 2;

    // Only apply if size matches (same zoom level)
    if (texSize === expectedTexSize) {
      updatePaddingEdge(textureData, edgeBytes, texSize, edgeDirection);
      dataTexture.needsUpdate = true;
      appliedEdges.push(edgeDirection);
    }
  }

  // Clear pending updates for this entity
  hillshadeContext.pendingEdges.delete(entityId);

  return appliedEdges;
}

/**
 * Rebind textures to all meshes using this entity
 */
function rebindTexturesForEntity(entityId: string, ctx: EventContext): void {
  const { textureFragmentIndex, loadedTexs, textureOptions } = ctx;

  // These are guaranteed to exist by validation in processHillshadeBackfilled
  if (!textureFragmentIndex || !loadedTexs || !textureOptions) {
    return;
  }

  const slots = getTextureFragmentSlots(textureFragmentIndex, entityId);
  if (!slots) return;

  // Deduplicate tileMeshes: same mesh may appear in multiple slots
  const uniqueMeshes = new Set<TileMesh>();
  for (const { tileMesh } of slots) {
    uniqueMeshes.add(tileMesh);
  }

  for (const tileMesh of uniqueMeshes) {
    tileMesh.rebindTextures(loadedTexs, textureOptions);
  }
}

/**
 * Process initial hillshade texture creation
 */
function processInitialHillshadeTexture(
  ctx: EventContext,
  event: HillshadeBackfilledEvent,
  entityId: string,
): void {
  const { loadedTexs, buf, tileHandler, hillshadeContext } = ctx;

  // These are guaranteed to exist by validation in processHillshadeBackfilled
  if (!loadedTexs || !buf || !tileHandler || !hillshadeContext) {
    return;
  }

  // Validate original_handle exists
  const originalHandle = event.original_handle;
  if (originalHandle === undefined || originalHandle === null) {
    return;
  }

  // Read data without removing - ResourceManager handles cleanup via reference counting
  // When multiple consumers (terrain, hillshade) share the same URL, the data is shared.
  // Reference count is decremented when each consumer entity is deleted.
  // Only when ref count reaches 0 (last consumer removed) is the data actually deleted.
  const originalBytes = buf.u8(originalHandle);
  if (!originalBytes) {
    return;
  }

  // Create padded DEM texture
  const dataTexture = createPaddedDemTexture(originalBytes);
  if (!dataTexture) {
    return;
  }

  // Get tile handle for calculations
  const tileHandleBigInt =
    typeof event.tile_handle === "bigint"
      ? event.tile_handle
      : BigInt(event.tile_handle);

  // Get tile info for zoom level (validate before doing expensive work)
  const tile = tileHandler.getTile(tileHandleBigInt);
  if (!tile) {
    dataTexture.dispose();
    return;
  }

  // Apply any pending edge updates that arrived before texture creation
  const appliedEdges = applyPendingEdges(
    dataTexture,
    hillshadeContext,
    entityId,
  );

  const metersPerTexel = tileHandler.calcMetersPerTexel(
    tileHandleBigInt,
    tile.coords.z,
    dataTexture.image.width,
  );

  // Get hillshade decoder config from tile (cached after first query)
  const hillshadeConfig = hillshadeContext.getHillshadeConfig(
    tileHandler,
    tileHandleBigInt,
  );

  // Calculate content dimensions from padded texture
  // createPaddedDemTexture adds 1px padding on each side, so subtract 2
  const contentWidth = dataTexture.image.width - 2;
  const contentHeight = dataTexture.image.height - 2;

  // Sanity check: in normal flow, loadedTexs should not have this entity yet
  if (loadedTexs.has(entityId)) {
    console.warn(
      `[Hillshade] Unexpected: loadedTexs already contains ${entityId}, cleaning up`,
    );
    hillshadeContext.clearRenderTarget(entityId);
    loadedTexs.delete(entityId);
  }

  // Generate normal map from DEM texture using RenderTarget pool
  // Pass explicit content dimensions to avoid fragile power-of-two inference
  const normalMap = hillshadeContext.generateNormalMap(
    entityId,
    ctx.viewContext,
    dataTexture,
    metersPerTexel,
    hillshadeConfig,
    contentWidth,
    contentHeight,
  );

  // Use normal map as the texture
  loadedTexs.set(entityId, normalMap);

  // Store temporary DEM texture for edge updates
  hillshadeContext.storeTempDem(
    entityId,
    dataTexture,
    metersPerTexel,
    hillshadeConfig,
  );

  // Mark the edges that were already applied from pending as received
  for (const edgeDirection of appliedEdges) {
    const allEdgesReceived = hillshadeContext.markEdgeReceived(
      entityId,
      edgeDirection,
    );
    if (allEdgesReceived) {
      hillshadeContext.clearTempDem(entityId);
      break;
    }
  }

  // Rebind textures to update the meshes
  rebindTexturesForEntity(entityId, ctx);
}

/**
 * Process hillshade edge update
 */
function processHillshadeEdgeUpdate(
  ctx: EventContext,
  event: HillshadeBackfilledEvent,
  entityId: string,
): void {
  const { loadedTexs, buf, hillshadeContext } = ctx;

  // These are guaranteed to exist by validation in processHillshadeBackfilled
  if (!loadedTexs || !buf || !hillshadeContext) {
    return;
  }

  // Validate edge_data_handle exists
  const edgeDataHandle = event.edge_data_handle;
  if (edgeDataHandle === undefined || edgeDataHandle === null) {
    return;
  }

  // Read edge data and remove from BufferStore immediately to prevent leaks
  const edgeBytes = buf.removeU8(edgeDataHandle);
  if (!edgeBytes) {
    return;
  }

  // Validate edge data: one edge (size pixels × 4 bytes RGBA)
  if (edgeBytes.length % 4 !== 0) {
    return;
  }

  const texture = loadedTexs.get(entityId);

  if (!texture) {
    // Texture doesn't exist yet - queue this edge update for later application
    let pending = hillshadeContext.pendingEdges.get(entityId);
    if (!pending) {
      pending = new Map<number, Uint8Array>();
      hillshadeContext.pendingEdges.set(entityId, pending);
    }
    // Copy and store edge data, replacing any previous update for this direction
    pending.set(event.edge_direction, new Uint8Array(edgeBytes));
    return;
  }

  // Texture exists (it's a normal map), check if we have the temporary DEM
  const tempDemEntry = hillshadeContext.getTempDem(entityId);
  if (!tempDemEntry) {
    // No temp DEM - edge updates complete or timed out, ignore this late arrival
    return;
  }

  const edgeSize = edgeBytes.length / 4;
  const demTexture = tempDemEntry.demTexture;
  const textureData = demTexture.image.data as Uint8Array;
  const texSize = demTexture.image.width;

  // Texture should be padded (edgeSize + 2)
  const expectedTexSize = edgeSize + 2;
  if (texSize !== expectedTexSize) {
    // Size mismatch - different zoom levels, discard this edge data
    return;
  }

  // Update the DEM texture padding edge
  updatePaddingEdge(textureData, edgeBytes, texSize, event.edge_direction);
  demTexture.needsUpdate = true;

  // Mark this edge as received
  const allEdgesReceived = hillshadeContext.markEdgeReceived(
    entityId,
    event.edge_direction,
  );

  // Regenerate normal map from updated DEM
  // Calculate content dimensions from padded texture (subtract 2px padding)
  const contentWidth = demTexture.image.width - 2;
  const contentHeight = demTexture.image.height - 2;
  const updatedTexture = hillshadeContext.generateNormalMap(
    entityId,
    ctx.viewContext,
    demTexture,
    tempDemEntry.metersPerTexel,
    tempDemEntry.hillshadeConfig,
    contentWidth,
    contentHeight,
  );
  loadedTexs.set(entityId, updatedTexture);

  // If all 4 edges received, cleanup the temporary DEM
  if (allEdgesReceived) {
    hillshadeContext.clearTempDem(entityId);
  }

  // Rebind textures to update the meshes
  rebindTexturesForEntity(entityId, ctx);
}

export function processHillshadeBackfilled(
  ctx: EventContext,
  event: HillshadeBackfilledEvent | undefined,
) {
  if (!event) return;

  const {
    loadedTexs,
    buf,
    textureFragmentIndex,
    textureOptions,
    tileHandler,
    hillshadeContext,
  } = ctx;

  if (
    !loadedTexs ||
    !buf ||
    !tileHandler ||
    !hillshadeContext ||
    !textureOptions ||
    !textureFragmentIndex
  ) {
    return;
  }

  // Use target_entity if provided (edge updates), otherwise use event entity (initialization)
  const entityId =
    event.target_entity_ind !== undefined &&
    event.target_entity_gen !== undefined
      ? `${event.target_entity_ind}_${event.target_entity_gen}`
      : generate_id_from_entity(event);

  // 1. Create texture if original data is provided
  if (event.original_handle !== undefined && event.original_handle !== null) {
    processInitialHillshadeTexture(ctx, event, entityId);
  }

  // 2. Update edges if edge data is provided
  if (event.edge_data_handle !== undefined && event.edge_data_handle !== null) {
    processHillshadeEdgeUpdate(ctx, event, entityId);
  }
}

/**
 * TODO: define this function in Rust and use it in web worker
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
 * TODO: define this function in Rust and use it in web worker
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
