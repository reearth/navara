import { DataTexture, RGBAFormat, UnsignedByteType } from "three";
import { describe, it, expect, beforeEach } from "vitest";

import { HillshadeContext } from "./HillshadeContext";
import type { HillshadeConfig } from "./HillshadeContext";

describe("HillshadeContext", () => {
  let context: HillshadeContext;
  const mockConfig: HillshadeConfig = {
    rgbScaler: [1, 1, 1],
    boundary: 0,
    minOffset: 0,
    maxOffset: 0,
    epsilon: 1.0,
    offset: 0,
  };

  beforeEach(() => {
    context = new HillshadeContext();
  });

  describe("pendingEdges management", () => {
    it("allows multiple edges for same entity", () => {
      const entityId = "tile_1";
      const edge0 = new Uint8Array([1, 2, 3, 4]);
      const edge1 = new Uint8Array([5, 6, 7, 8]);

      const pending = new Map<number, Uint8Array>();
      pending.set(0, edge0);
      pending.set(1, edge1);
      context.pendingEdges.set(entityId, pending);

      const stored = context.pendingEdges.get(entityId);
      expect(stored).toBeDefined();
      expect(stored?.size).toBe(2);
      expect(stored?.get(0)).toBe(edge0);
      expect(stored?.get(1)).toBe(edge1);
    });

    it("overwrites pending edge for same direction", () => {
      const entityId = "tile_1";
      const oldEdge = new Uint8Array([1, 2, 3, 4]);
      const newEdge = new Uint8Array([5, 6, 7, 8]);

      const pending = new Map<number, Uint8Array>();
      pending.set(0, oldEdge);
      context.pendingEdges.set(entityId, pending);

      // Overwrite with new edge
      pending.set(0, newEdge);

      const stored = context.pendingEdges.get(entityId);
      expect(stored).toBeDefined();
      expect(stored?.get(0)).toBe(newEdge);
      expect(stored?.get(0)).not.toBe(oldEdge);
    });
  });

  describe("tempDemTextures lifecycle", () => {
    function createMockDemTexture(): DataTexture {
      const data = new Uint8Array(4 * 4 * 4); // 4x4 RGBA
      return new DataTexture(data, 4, 4, RGBAFormat, UnsignedByteType);
    }

    it("stores and retrieves temp DEM", () => {
      const entityId = "tile_1";
      const demTexture = createMockDemTexture();

      context.storeTempDem(entityId, demTexture, 1.0, mockConfig);

      const entry = context.getTempDem(entityId);
      expect(entry).toBeDefined();
      expect(entry?.demTexture).toBe(demTexture);
      expect(entry?.metersPerTexel).toBe(1.0);
      expect(entry?.receivedEdges.size).toBe(0);
    });

    it("initializes with empty receivedEdges set", () => {
      const entityId = "tile_1";
      const demTexture = createMockDemTexture();

      context.storeTempDem(entityId, demTexture, 1.0, mockConfig);

      const entry = context.getTempDem(entityId);
      expect(entry).toBeDefined();
      expect(entry?.receivedEdges).toBeInstanceOf(Set);
      expect(entry?.receivedEdges.size).toBe(0);
    });

    it("tracks edge reception", () => {
      const entityId = "tile_1";
      const demTexture = createMockDemTexture();

      context.storeTempDem(entityId, demTexture, 1.0, mockConfig);

      // Mark edges as received
      expect(context.markEdgeReceived(entityId, 0)).toBe(false); // 1/4
      expect(context.markEdgeReceived(entityId, 1)).toBe(false); // 2/4
      expect(context.markEdgeReceived(entityId, 2)).toBe(false); // 3/4
      expect(context.markEdgeReceived(entityId, 3)).toBe(true); // 4/4 - all received

      const entry = context.getTempDem(entityId);
      expect(entry).toBeDefined();
      expect(entry?.receivedEdges.size).toBe(4);
    });

    it("handles duplicate edge reception", () => {
      const entityId = "tile_1";
      const demTexture = createMockDemTexture();

      context.storeTempDem(entityId, demTexture, 1.0, mockConfig);

      // Mark same edge multiple times
      expect(context.markEdgeReceived(entityId, 0)).toBe(false);
      expect(context.markEdgeReceived(entityId, 0)).toBe(false); // Duplicate
      expect(context.markEdgeReceived(entityId, 0)).toBe(false); // Duplicate

      const entry = context.getTempDem(entityId);
      expect(entry).toBeDefined();
      expect(entry?.receivedEdges.size).toBe(1); // Still only 1 edge
    });

    it("clears temp DEM and disposes texture", () => {
      const entityId = "tile_1";
      const demTexture = createMockDemTexture();
      let disposeCalled = false;

      // Mock dispose method
      demTexture.dispose = () => {
        disposeCalled = true;
      };

      context.storeTempDem(entityId, demTexture, 1.0, mockConfig);
      expect(context.getTempDem(entityId)).toBeDefined();

      context.clearTempDem(entityId);

      expect(context.getTempDem(entityId)).toBeUndefined();
      expect(disposeCalled).toBe(true);
    });

    it("replaces existing temp DEM when storing new one", () => {
      const entityId = "tile_1";
      const oldDemTexture = createMockDemTexture();
      const newDemTexture = createMockDemTexture();
      let oldDisposeCalled = false;

      oldDemTexture.dispose = () => {
        oldDisposeCalled = true;
      };

      // Store old DEM
      context.storeTempDem(entityId, oldDemTexture, 1.0, mockConfig);
      context.markEdgeReceived(entityId, 0);

      // Store new DEM (should clear old one)
      context.storeTempDem(entityId, newDemTexture, 2.0, mockConfig);

      const entry = context.getTempDem(entityId);
      expect(entry).toBeDefined();
      expect(entry?.demTexture).toBe(newDemTexture);
      expect(entry?.metersPerTexel).toBe(2.0);
      expect(entry?.receivedEdges.size).toBe(0); // Reset
      expect(oldDisposeCalled).toBe(true);
    });
  });

  describe("edge-driven lifecycle integration", () => {
    function createMockDemTexture(): DataTexture {
      const data = new Uint8Array(4 * 4 * 4);
      return new DataTexture(data, 4, 4, RGBAFormat, UnsignedByteType);
    }

    it("scenario: all edges arrive before texture creation", () => {
      const entityId = "tile_1";

      // Edges arrive before texture
      const pending = new Map<number, Uint8Array>();
      pending.set(0, new Uint8Array([1, 2, 3, 4]));
      pending.set(1, new Uint8Array([5, 6, 7, 8]));
      pending.set(2, new Uint8Array([9, 10, 11, 12]));
      pending.set(3, new Uint8Array([13, 14, 15, 16]));
      context.pendingEdges.set(entityId, pending);

      // Texture created - pending edges should be applied
      const demTexture = createMockDemTexture();
      context.storeTempDem(entityId, demTexture, 1.0, mockConfig);

      // All edges should be marked as received
      context.markEdgeReceived(entityId, 0);
      context.markEdgeReceived(entityId, 1);
      context.markEdgeReceived(entityId, 2);
      const allReceived = context.markEdgeReceived(entityId, 3);

      expect(allReceived).toBe(true);
      const finalEntry = context.getTempDem(entityId);
      expect(finalEntry).toBeDefined();
      expect(finalEntry?.receivedEdges.size).toBe(4);

      // Should be safe to clear
      context.clearTempDem(entityId);
      expect(context.getTempDem(entityId)).toBeUndefined();
    });

    it("scenario: edges arrive after texture, then all cleared", () => {
      const entityId = "tile_1";
      const demTexture = createMockDemTexture();

      // Texture created first
      context.storeTempDem(entityId, demTexture, 1.0, mockConfig);

      // Edges arrive one by one
      expect(context.markEdgeReceived(entityId, 0)).toBe(false);
      expect(context.markEdgeReceived(entityId, 1)).toBe(false);
      expect(context.markEdgeReceived(entityId, 2)).toBe(false);
      expect(context.markEdgeReceived(entityId, 3)).toBe(true);

      // All edges received, should clear
      context.clearTempDem(entityId);
      expect(context.getTempDem(entityId)).toBeUndefined();
    });

    it("scenario: late edge arrives after temp DEM cleared", () => {
      const entityId = "tile_1";
      const demTexture = createMockDemTexture();

      context.storeTempDem(entityId, demTexture, 1.0, mockConfig);

      // First 4 edges arrive
      context.markEdgeReceived(entityId, 0);
      context.markEdgeReceived(entityId, 1);
      context.markEdgeReceived(entityId, 2);
      context.markEdgeReceived(entityId, 3);

      // Temp DEM cleared
      context.clearTempDem(entityId);

      // Late edge arrives (should be ignored safely)
      const result = context.markEdgeReceived(entityId, 0);
      expect(result).toBe(false); // No temp DEM exists
    });

    it("scenario: mixed order (some pending, some after)", () => {
      const entityId = "tile_1";

      // 2 edges arrive early (pending)
      const pending = new Map<number, Uint8Array>();
      pending.set(0, new Uint8Array([1, 2, 3, 4]));
      pending.set(2, new Uint8Array([9, 10, 11, 12]));
      context.pendingEdges.set(entityId, pending);

      // Texture created
      const demTexture = createMockDemTexture();
      context.storeTempDem(entityId, demTexture, 1.0, mockConfig);

      // Mark the 2 pending edges as received
      context.markEdgeReceived(entityId, 0);
      context.markEdgeReceived(entityId, 2);

      // Remaining edges arrive
      expect(context.markEdgeReceived(entityId, 1)).toBe(false);
      expect(context.markEdgeReceived(entityId, 3)).toBe(true); // Last one

      const mixedEntry = context.getTempDem(entityId);
      expect(mixedEntry).toBeDefined();
      expect(mixedEntry?.receivedEdges.size).toBe(4);
    });
  });
});
