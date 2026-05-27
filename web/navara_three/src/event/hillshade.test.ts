import type { HillshadeBackfilledEvent } from "@navara/engine";
import { DataTexture, Texture } from "three";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { EventContext } from "./context";
import {
  updatePaddingEdge,
  replicateEdgesToPadding,
  processHillshadeBackfilled,
} from "./hillshade";
import { HillshadeContext } from "./HillshadeContext";

// Mock generate_id_from_entity
vi.mock("@navara/core", () => ({
  generate_id_from_entity: (event: any) => `${event.ind}_${event.gen}`,
}));

/**
 * Helper to create a test texture with unique RGBA values per pixel
 * R channel = x coordinate
 * G channel = y coordinate
 * B channel = x + y
 * A channel = 255
 */
function createTestTexture(size: number): Uint8Array {
  const buffer = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      buffer[idx] = x; // R
      buffer[idx + 1] = y; // G
      buffer[idx + 2] = (x + y) % 256; // B
      buffer[idx + 3] = 255; // A
    }
  }
  return buffer;
}

/**
 * Helper to get pixel RGBA values from texture
 */
function getPixel(
  buffer: Uint8Array,
  x: number,
  y: number,
  width: number,
): [number, number, number, number] {
  const idx = (y * width + x) * 4;
  return [buffer[idx], buffer[idx + 1], buffer[idx + 2], buffer[idx + 3]];
}

describe("replicateEdgesToPadding", () => {
  it("replicates edges for a 4×4 content texture (6×6 padded)", () => {
    const contentSize = 4;
    const paddedSize = contentSize + 2;
    const paddedBytes = new Uint8Array(paddedSize * paddedSize * 4);

    // Fill center with test pattern
    const testContent = createTestTexture(contentSize);
    for (let y = 0; y < contentSize; y++) {
      for (let x = 0; x < contentSize; x++) {
        const srcIdx = (y * contentSize + x) * 4;
        const dstIdx = ((y + 1) * paddedSize + (x + 1)) * 4;
        paddedBytes[dstIdx] = testContent[srcIdx];
        paddedBytes[dstIdx + 1] = testContent[srcIdx + 1];
        paddedBytes[dstIdx + 2] = testContent[srcIdx + 2];
        paddedBytes[dstIdx + 3] = testContent[srcIdx + 3];
      }
    }

    replicateEdgesToPadding(paddedBytes, paddedSize);

    // Verify top padding (y=0): should match first content row (y=1)
    for (let x = 1; x <= contentSize; x++) {
      const paddingPixel = getPixel(paddedBytes, x, 0, paddedSize);
      const contentPixel = getPixel(paddedBytes, x, 1, paddedSize);
      expect(paddingPixel).toEqual(contentPixel);
    }

    // Verify bottom padding (y=5): should match last content row (y=4)
    for (let x = 1; x <= contentSize; x++) {
      const paddingPixel = getPixel(paddedBytes, x, paddedSize - 1, paddedSize);
      const contentPixel = getPixel(paddedBytes, x, contentSize, paddedSize);
      expect(paddingPixel).toEqual(contentPixel);
    }

    // Verify left padding (x=0): should match first content column (x=1)
    for (let y = 1; y <= contentSize; y++) {
      const paddingPixel = getPixel(paddedBytes, 0, y, paddedSize);
      const contentPixel = getPixel(paddedBytes, 1, y, paddedSize);
      expect(paddingPixel).toEqual(contentPixel);
    }

    // Verify right padding (x=5): should match last content column (x=4)
    for (let y = 1; y <= contentSize; y++) {
      const paddingPixel = getPixel(paddedBytes, paddedSize - 1, y, paddedSize);
      const contentPixel = getPixel(paddedBytes, contentSize, y, paddedSize);
      expect(paddingPixel).toEqual(contentPixel);
    }

    // Verify corners
    const topLeft = getPixel(paddedBytes, 0, 0, paddedSize);
    const topLeftContent = getPixel(paddedBytes, 1, 1, paddedSize);
    expect(topLeft).toEqual(topLeftContent);

    const topRight = getPixel(paddedBytes, paddedSize - 1, 0, paddedSize);
    const topRightContent = getPixel(paddedBytes, contentSize, 1, paddedSize);
    expect(topRight).toEqual(topRightContent);

    const bottomLeft = getPixel(paddedBytes, 0, paddedSize - 1, paddedSize);
    const bottomLeftContent = getPixel(paddedBytes, 1, contentSize, paddedSize);
    expect(bottomLeft).toEqual(bottomLeftContent);

    const bottomRight = getPixel(
      paddedBytes,
      paddedSize - 1,
      paddedSize - 1,
      paddedSize,
    );
    const bottomRightContent = getPixel(
      paddedBytes,
      contentSize,
      contentSize,
      paddedSize,
    );
    expect(bottomRight).toEqual(bottomRightContent);
  });

  it("replicates edges for a 256×256 content texture (258×258 padded)", () => {
    const contentSize = 256;
    const paddedSize = contentSize + 2;
    const paddedBytes = new Uint8Array(paddedSize * paddedSize * 4);

    // Fill center with test pattern
    const testContent = createTestTexture(contentSize);
    for (let y = 0; y < contentSize; y++) {
      for (let x = 0; x < contentSize; x++) {
        const srcIdx = (y * contentSize + x) * 4;
        const dstIdx = ((y + 1) * paddedSize + (x + 1)) * 4;
        paddedBytes[dstIdx] = testContent[srcIdx];
        paddedBytes[dstIdx + 1] = testContent[srcIdx + 1];
        paddedBytes[dstIdx + 2] = testContent[srcIdx + 2];
        paddedBytes[dstIdx + 3] = testContent[srcIdx + 3];
      }
    }

    replicateEdgesToPadding(paddedBytes, paddedSize);

    // Sample check: verify a few pixels on each edge
    // Top edge (y=0, x=128) should match (y=1, x=128)
    expect(getPixel(paddedBytes, 128, 0, paddedSize)).toEqual(
      getPixel(paddedBytes, 128, 1, paddedSize),
    );

    // Bottom edge (y=257, x=128) should match (y=256, x=128)
    expect(getPixel(paddedBytes, 128, 257, paddedSize)).toEqual(
      getPixel(paddedBytes, 128, 256, paddedSize),
    );

    // Left edge (x=0, y=128) should match (x=1, y=128)
    expect(getPixel(paddedBytes, 0, 128, paddedSize)).toEqual(
      getPixel(paddedBytes, 1, 128, paddedSize),
    );

    // Right edge (x=257, y=128) should match (x=256, y=128)
    expect(getPixel(paddedBytes, 257, 128, paddedSize)).toEqual(
      getPixel(paddedBytes, 256, 128, paddedSize),
    );
  });
});

describe("updatePaddingEdge", () => {
  const contentSize = 4;
  const paddedSize = contentSize + 2; // 6×6

  function createPaddedTexture(): Uint8Array {
    const paddedBytes = new Uint8Array(paddedSize * paddedSize * 4);
    const testContent = createTestTexture(contentSize);

    // Fill center
    for (let y = 0; y < contentSize; y++) {
      for (let x = 0; x < contentSize; x++) {
        const srcIdx = (y * contentSize + x) * 4;
        const dstIdx = ((y + 1) * paddedSize + (x + 1)) * 4;
        paddedBytes[dstIdx] = testContent[srcIdx];
        paddedBytes[dstIdx + 1] = testContent[srcIdx + 1];
        paddedBytes[dstIdx + 2] = testContent[srcIdx + 2];
        paddedBytes[dstIdx + 3] = testContent[srcIdx + 3];
      }
    }

    replicateEdgesToPadding(paddedBytes, paddedSize);
    return paddedBytes;
  }

  function createEdgeData(
    direction: "left" | "right" | "top" | "bottom",
  ): Uint8Array {
    const edgeBytes = new Uint8Array(contentSize * 4);
    for (let i = 0; i < contentSize; i++) {
      const idx = i * 4;
      // Use unique values to verify correct placement
      switch (direction) {
        case "left":
          edgeBytes[idx] = 100 + i; // R
          edgeBytes[idx + 1] = i; // G
          break;
        case "right":
          edgeBytes[idx] = 200 + i; // R
          edgeBytes[idx + 1] = i; // G
          break;
        case "top":
          edgeBytes[idx] = i; // R
          edgeBytes[idx + 1] = 100 + i; // G
          break;
        case "bottom":
          edgeBytes[idx] = i; // R
          edgeBytes[idx + 1] = 200 + i; // G
          break;
      }
      edgeBytes[idx + 2] = 50; // B (constant)
      edgeBytes[idx + 3] = 255; // A
    }
    return edgeBytes;
  }

  it("updates left padding (direction=0, x=0)", () => {
    const textureData = createPaddedTexture();
    const edgeBytes = createEdgeData("left");

    updatePaddingEdge(textureData, edgeBytes, paddedSize, 0);

    // Verify left padding column (x=0, y=1..4)
    for (let y = 0; y < contentSize; y++) {
      const pixel = getPixel(textureData, 0, y + 1, paddedSize);
      expect(pixel[0]).toBe(100 + y); // R
      expect(pixel[1]).toBe(y); // G
      expect(pixel[2]).toBe(50); // B
      expect(pixel[3]).toBe(255); // A
    }
  });

  it("updates right padding (direction=1, x=paddedSize-1)", () => {
    const textureData = createPaddedTexture();
    const edgeBytes = createEdgeData("right");

    updatePaddingEdge(textureData, edgeBytes, paddedSize, 1);

    // Verify right padding column (x=5, y=1..4)
    for (let y = 0; y < contentSize; y++) {
      const pixel = getPixel(textureData, paddedSize - 1, y + 1, paddedSize);
      expect(pixel[0]).toBe(200 + y); // R
      expect(pixel[1]).toBe(y); // G
      expect(pixel[2]).toBe(50); // B
      expect(pixel[3]).toBe(255); // A
    }
  });

  it("updates top padding (direction=2, y=0)", () => {
    const textureData = createPaddedTexture();
    const edgeBytes = createEdgeData("top");

    updatePaddingEdge(textureData, edgeBytes, paddedSize, 2);

    // Verify top padding row (y=0, x=1..4)
    for (let x = 0; x < contentSize; x++) {
      const pixel = getPixel(textureData, x + 1, 0, paddedSize);
      expect(pixel[0]).toBe(x); // R
      expect(pixel[1]).toBe(100 + x); // G
      expect(pixel[2]).toBe(50); // B
      expect(pixel[3]).toBe(255); // A
    }
  });

  it("updates bottom padding (direction=3, y=paddedSize-1)", () => {
    const textureData = createPaddedTexture();
    const edgeBytes = createEdgeData("bottom");

    updatePaddingEdge(textureData, edgeBytes, paddedSize, 3);

    // Verify bottom padding row (y=5, x=1..4)
    for (let x = 0; x < contentSize; x++) {
      const pixel = getPixel(textureData, x + 1, paddedSize - 1, paddedSize);
      expect(pixel[0]).toBe(x); // R
      expect(pixel[1]).toBe(200 + x); // G
      expect(pixel[2]).toBe(50); // B
      expect(pixel[3]).toBe(255); // A
    }
  });

  it("does not modify content area when updating padding", () => {
    const textureData = createPaddedTexture();
    const edgeBytes = createEdgeData("left");

    // Capture content before update
    const contentBefore = new Uint8Array(contentSize * contentSize * 4);
    for (let y = 0; y < contentSize; y++) {
      for (let x = 0; x < contentSize; x++) {
        const srcIdx = ((y + 1) * paddedSize + (x + 1)) * 4;
        const dstIdx = (y * contentSize + x) * 4;
        contentBefore[dstIdx] = textureData[srcIdx];
        contentBefore[dstIdx + 1] = textureData[srcIdx + 1];
        contentBefore[dstIdx + 2] = textureData[srcIdx + 2];
        contentBefore[dstIdx + 3] = textureData[srcIdx + 3];
      }
    }

    updatePaddingEdge(textureData, edgeBytes, paddedSize, 0);

    // Verify content is unchanged
    for (let y = 0; y < contentSize; y++) {
      for (let x = 0; x < contentSize; x++) {
        const srcIdx = ((y + 1) * paddedSize + (x + 1)) * 4;
        const dstIdx = (y * contentSize + x) * 4;
        expect(textureData[srcIdx]).toBe(contentBefore[dstIdx]);
        expect(textureData[srcIdx + 1]).toBe(contentBefore[dstIdx + 1]);
        expect(textureData[srcIdx + 2]).toBe(contentBefore[dstIdx + 2]);
        expect(textureData[srcIdx + 3]).toBe(contentBefore[dstIdx + 3]);
      }
    }
  });

  it("handles 256×256 content (258×258 padded)", () => {
    const largeContentSize = 256;
    const largePaddedSize = largeContentSize + 2;
    const textureData = new Uint8Array(largePaddedSize * largePaddedSize * 4);
    const edgeBytes = new Uint8Array(largeContentSize * 4);

    // Fill edge with marker values
    for (let i = 0; i < largeContentSize; i++) {
      edgeBytes[i * 4] = 123; // R
      edgeBytes[i * 4 + 1] = i % 256; // G
      edgeBytes[i * 4 + 2] = 45; // B
      edgeBytes[i * 4 + 3] = 255; // A
    }

    updatePaddingEdge(textureData, edgeBytes, largePaddedSize, 0);

    // Verify left padding (sample a few pixels)
    for (let y = 0; y < largeContentSize; y += 64) {
      const pixel = getPixel(textureData, 0, y + 1, largePaddedSize);
      expect(pixel[0]).toBe(123);
      expect(pixel[1]).toBe(y % 256);
      expect(pixel[2]).toBe(45);
      expect(pixel[3]).toBe(255);
    }
  });
});

/**
 * Tests for hillshade normal map generation lifecycle
 * Covers: original-before-edges, edges-before-original, size mismatch, temp DEM cleanup
 */
describe("hillshade normal map generation", () => {
  let mockContext: EventContext;
  let hillshadeContext: HillshadeContext;
  let loadedTexs: Map<string, DataTexture>;
  let mockBufferStore: Map<number, Uint8Array>;
  let nextHandle: number;

  beforeEach(() => {
    // Reset state for each test
    hillshadeContext = new HillshadeContext();
    loadedTexs = new Map();
    mockBufferStore = new Map();
    nextHandle = 1;

    // Create mock ViewContext with renderer
    const mockRenderer = {
      getRenderTarget: vi.fn(() => null),
      setRenderTarget: vi.fn(),
      render: vi.fn(),
      readRenderTargetPixels: vi.fn((_target, _x, _y, _w, _h, buffer) => {
        // Fill with test pattern
        for (let i = 0; i < buffer.length; i += 4) {
          buffer[i] = 128; // R
          buffer[i + 1] = 128; // G
          buffer[i + 2] = 255; // B
          buffer[i + 3] = 255; // A
        }
      }),
    };

    const mockViewContext = {
      getRenderer: () => mockRenderer,
    };

    // Create mock TileHandler
    const mockTileHandler = {
      getTile: vi.fn((_handle: bigint) => ({
        coords: { z: 14, x: 14507, y: 6473 },
      })),
      calcMetersPerTexel: vi.fn(() => 7.798810005187988),
      getTileElevationDecoder: vi.fn(() => ({
        r_scaler: 256,
        g_scaler: 1,
        b_scaler: 1 / 256,
        boundary: 0,
        min_offset: 0,
        max_offset: 0,
        epsilon: 1.0,
        offset: -32768,
      })),
    };

    // Create mock BufferStore
    const mockBuf = {
      u8: vi.fn((handle: number) => mockBufferStore.get(handle)),
      removeU8: vi.fn((handle: number) => mockBufferStore.get(handle)),
    };

    // Create mock texture fragment index
    const mockTextureFragmentIndex = new Map();

    // Create mock texture options
    const mockTextureOptions = new Map();

    mockContext = {
      viewContext: mockViewContext as any,
      loadedTexs,
      buf: mockBuf as any,
      textureFragmentIndex: mockTextureFragmentIndex as any,
      textureOptions: mockTextureOptions as any,
      tileHandler: mockTileHandler as any,
      hillshadeContext,
    } as unknown as EventContext;
  });

  /**
   * Helper to create test DEM data (4×4 content = 16 pixels)
   */
  function createTestDemData(): Uint8Array {
    const size = 4;
    const buffer = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        buffer[idx] = x * 10; // R
        buffer[idx + 1] = y * 10; // G
        buffer[idx + 2] = (x + y) * 5; // B
        buffer[idx + 3] = 255; // A
      }
    }
    return buffer;
  }

  /**
   * Helper to create edge data (4 pixels for a 4×4 content texture)
   */
  function createEdgeData(value: number): Uint8Array {
    const edgeSize = 4;
    const buffer = new Uint8Array(edgeSize * 4);
    for (let i = 0; i < edgeSize; i++) {
      buffer[i * 4] = value; // R
      buffer[i * 4 + 1] = value + 10; // G
      buffer[i * 4 + 2] = value + 20; // B
      buffer[i * 4 + 3] = 255; // A
    }
    return buffer;
  }

  /**
   * Helper to store buffer and get handle
   */
  function storeBuffer(data: Uint8Array): number {
    const handle = nextHandle++;
    mockBufferStore.set(handle, data);
    return handle;
  }

  it("generates normal map when original DEM arrives (original-before-edges)", () => {
    const entityId = "1_123"; // Format: {entity_ind}_{entity_gen}
    const demData = createTestDemData();
    const demHandle = storeBuffer(demData);

    const event = {
      ind: 1,
      gen: 123,
      tile_handle: 999n,
      original_handle: demHandle,
      edge_data_handle: -1,
      edge_direction: 0,
      target_entity_ind: undefined,
      target_entity_gen: undefined,
    } as HillshadeBackfilledEvent;

    processHillshadeBackfilled(mockContext, event);

    // Verify normal map was generated and stored
    expect(loadedTexs.has(entityId)).toBe(true);
    const normalMap = loadedTexs.get(entityId);
    expect(normalMap).toBeInstanceOf(Texture);
    if (normalMap) {
      expect(normalMap.image.width).toBe(4); // Content size (no padding in normal map)
    }

    // Verify temp DEM was stored for edge updates
    const tempDem = hillshadeContext.getTempDem(entityId);
    expect(tempDem).toBeDefined();
    expect(tempDem?.demTexture).toBeInstanceOf(Texture);
    expect(tempDem?.demTexture.image.width).toBe(6); // Padded size (4 + 2)
    expect(tempDem?.receivedEdges.size).toBe(0);
  });

  it("regenerates normal map when edge arrives after original", () => {
    const entityId = "1_123"; // Format: {entity_ind}_{entity_gen}

    // Step 1: Original DEM arrives
    const demData = createTestDemData();
    const demHandle = storeBuffer(demData);
    processHillshadeBackfilled(mockContext, {
      ind: 1,
      gen: 123,
      tile_handle: 999n,
      original_handle: demHandle,
      edge_data_handle: -1,
      edge_direction: 0,
      target_entity_ind: undefined,
      target_entity_gen: undefined,
    } as HillshadeBackfilledEvent);

    const firstNormalMap = loadedTexs.get(entityId);
    expect(firstNormalMap).toBeInstanceOf(Texture);

    // Step 2: Left edge arrives (direction 0)
    const edgeData = createEdgeData(100);
    const edgeHandle = storeBuffer(edgeData);
    processHillshadeBackfilled(mockContext, {
      ind: 999,
      gen: 999,
      tile_handle: 999n,
      original_handle: -1,
      edge_data_handle: edgeHandle,
      edge_direction: 0,
      target_entity_ind: 1,
      target_entity_gen: 123,
    } as HillshadeBackfilledEvent);

    // Verify normal map is still the same texture instance (RenderTarget reuse)
    // Content is updated in-place on GPU, texture reference stays the same
    const secondNormalMap = loadedTexs.get(entityId);
    expect(secondNormalMap).toBeInstanceOf(Texture);
    expect(secondNormalMap).toBe(firstNormalMap); // Same texture instance (updated in-place)

    // Verify edge was marked as received
    const tempDem = hillshadeContext.getTempDem(entityId);
    expect(tempDem?.receivedEdges.has(0)).toBe(true);
    expect(tempDem?.receivedEdges.size).toBe(1);
  });

  it("cleans up temp DEM after all 4 edges received", () => {
    const entityId = "1_123"; // Format: {entity_ind}_{entity_gen}

    // Step 1: Original arrives
    const demData = createTestDemData();
    processHillshadeBackfilled(mockContext, {
      ind: 1,
      gen: 123,
      tile_handle: 999n,
      original_handle: storeBuffer(demData),
      edge_data_handle: -1,
      edge_direction: 0,
      target_entity_ind: undefined,
      target_entity_gen: undefined,
    } as HillshadeBackfilledEvent);

    expect(hillshadeContext.getTempDem(entityId)).toBeDefined();
    expect(loadedTexs.has(entityId)).toBe(true);

    // Step 2-5: All 4 edges arrive (directions 0, 1, 2, 3)
    for (let direction = 0; direction < 4; direction++) {
      processHillshadeBackfilled(mockContext, {
        ind: 999,
        gen: 999,
        tile_handle: 999n,
        original_handle: -1,
        edge_data_handle: storeBuffer(createEdgeData(100 + direction)),
        edge_direction: direction,
        target_entity_ind: 1,
        target_entity_gen: 123,
      } as HillshadeBackfilledEvent);

      if (direction < 3) {
        // Not all edges received yet
        expect(hillshadeContext.getTempDem(entityId)).toBeDefined();
        expect(hillshadeContext.getTempDem(entityId)?.receivedEdges.size).toBe(
          direction + 1,
        );
      } else {
        // All 4 edges received, temp DEM should be cleaned up
        expect(hillshadeContext.getTempDem(entityId)).toBeUndefined();
      }
    }

    // Verify texture still exists after cleanup
    expect(loadedTexs.has(entityId)).toBe(true);
  });

  it("queues edges that arrive before original (edges-before-original)", () => {
    const entityId = "1_123"; // Format: {entity_ind}_{entity_gen}

    // Step 1: Edges arrive first (directions 0, 1)
    processHillshadeBackfilled(mockContext, {
      ind: 999,
      gen: 999,
      tile_handle: 999n,
      original_handle: -1,
      edge_data_handle: storeBuffer(createEdgeData(100)),
      edge_direction: 0,
      target_entity_ind: 1,
      target_entity_gen: 123,
    } as HillshadeBackfilledEvent);

    processHillshadeBackfilled(mockContext, {
      ind: 999,
      gen: 999,
      tile_handle: 999n,
      original_handle: -1,
      edge_data_handle: storeBuffer(createEdgeData(110)),
      edge_direction: 1,
      target_entity_ind: 1,
      target_entity_gen: 123,
    } as HillshadeBackfilledEvent);

    // Verify edges are queued, no texture created yet
    expect(loadedTexs.has(entityId)).toBe(false);
    const pendingMap = hillshadeContext.pendingEdges.get(entityId);
    expect(pendingMap).toBeDefined();
    expect(pendingMap?.size).toBe(2);
    expect(pendingMap?.has(0)).toBe(true);
    expect(pendingMap?.has(1)).toBe(true);

    // Step 2: Original arrives
    const demData = createTestDemData();
    processHillshadeBackfilled(mockContext, {
      ind: 1,
      gen: 123,
      tile_handle: 999n,
      original_handle: storeBuffer(demData),
      edge_data_handle: -1,
      edge_direction: 0,
      target_entity_ind: undefined,
      target_entity_gen: undefined,
    } as HillshadeBackfilledEvent);

    // Verify normal map was generated with pending edges applied
    expect(loadedTexs.has(entityId)).toBe(true);
    expect(loadedTexs.get(entityId)).toBeInstanceOf(Texture);

    // Verify pending edges were cleared
    expect(hillshadeContext.pendingEdges.has(entityId)).toBe(false);

    // Verify edges were marked as received in temp DEM
    const tempDem = hillshadeContext.getTempDem(entityId);
    expect(tempDem?.receivedEdges.has(0)).toBe(true);
    expect(tempDem?.receivedEdges.has(1)).toBe(true);
    expect(tempDem?.receivedEdges.size).toBe(2);
  });

  it("handles multiple entities independently", () => {
    const entity1 = "1_123";
    const entity2 = "2_456";

    // Create textures for both entities
    processHillshadeBackfilled(mockContext, {
      ind: 1,
      gen: 123,
      tile_handle: 999n,
      original_handle: storeBuffer(createTestDemData()),
      edge_data_handle: -1,
      edge_direction: 0,
      target_entity_ind: undefined,
      target_entity_gen: undefined,
    } as HillshadeBackfilledEvent);

    processHillshadeBackfilled(mockContext, {
      ind: 2,
      gen: 456,
      tile_handle: 888n,
      original_handle: storeBuffer(createTestDemData()),
      edge_data_handle: -1,
      edge_direction: 0,
      target_entity_ind: undefined,
      target_entity_gen: undefined,
    } as HillshadeBackfilledEvent);

    // Verify both have textures and temp DEMs
    expect(loadedTexs.has(entity1)).toBe(true);
    expect(loadedTexs.has(entity2)).toBe(true);
    expect(hillshadeContext.getTempDem(entity1)).toBeDefined();
    expect(hillshadeContext.getTempDem(entity2)).toBeDefined();

    // Send edge to entity1
    processHillshadeBackfilled(mockContext, {
      ind: 999,
      gen: 999,
      tile_handle: 999n,
      original_handle: -1,
      edge_data_handle: storeBuffer(createEdgeData(100)),
      edge_direction: 0,
      target_entity_ind: 1,
      target_entity_gen: 123,
    } as HillshadeBackfilledEvent);

    // Verify only entity1 was updated
    const tempDem1 = hillshadeContext.getTempDem(entity1);
    const tempDem2 = hillshadeContext.getTempDem(entity2);
    expect(tempDem1?.receivedEdges.size).toBe(1);
    expect(tempDem2?.receivedEdges.size).toBe(0);
  });
});
