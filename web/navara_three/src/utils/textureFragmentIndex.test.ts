import { describe, it, expect, beforeEach } from "vitest";
import {
  updateTextureFragmentIndex,
  removeTextureFragmentIndex,
  getTextureFragmentSlots,
} from "./textureFragmentIndex";
import type { TileMesh } from "../mesh/tile";

function createTileMesh(id: string): TileMesh {
  return { id } as unknown as TileMesh;
}

function getSlotIndexes(fragmentId: string, tileMesh: TileMesh): number[] {
  const slots = getTextureFragmentSlots(fragmentId);
  if (!slots) return [];

  return [...slots]
    .filter((slot) => slot.tileMesh === tileMesh)
    .map((slot) => slot.slotIndex)
    .sort((a, b) => a - b);
}

describe("textureFragmentIndex", () => {
  beforeEach(() => {
    // The module stores its state in a global Map.
    // To avoid cross-test pollution, each test removes the tile meshes it creates.
  });

  it("indexes texture fragments for a tile mesh", () => {
    const tileMesh = createTileMesh("tile-1");

    updateTextureFragmentIndex(tileMesh, ["frag-a", null, "frag-b"]);

    const fragASlots = getTextureFragmentSlots("frag-a");
    const fragBSlots = getTextureFragmentSlots("frag-b");
    const fragCSlots = getTextureFragmentSlots("frag-c");

    expect(fragASlots).toBeDefined();
    expect(fragBSlots).toBeDefined();
    expect(fragCSlots).toBeUndefined();

    expect(getSlotIndexes("frag-a", tileMesh)).toEqual([0]);
    expect(getSlotIndexes("frag-b", tileMesh)).toEqual([2]);

    removeTextureFragmentIndex(tileMesh);
  });

  it("supports multiple tile meshes using the same fragment", () => {
    const tileMesh1 = createTileMesh("tile-1");
    const tileMesh2 = createTileMesh("tile-2");

    updateTextureFragmentIndex(tileMesh1, ["frag-shared"]);
    updateTextureFragmentIndex(tileMesh2, ["frag-shared", "frag-x"]);

    const sharedSlots = getTextureFragmentSlots("frag-shared");
    expect(sharedSlots).toBeDefined();
    expect(sharedSlots && [...sharedSlots].length).toBe(2);

    expect(getSlotIndexes("frag-shared", tileMesh1)).toEqual([0]);
    expect(getSlotIndexes("frag-shared", tileMesh2)).toEqual([0]);
    expect(getSlotIndexes("frag-x", tileMesh2)).toEqual([1]);

    removeTextureFragmentIndex(tileMesh1);
    removeTextureFragmentIndex(tileMesh2);
  });

  it("removes previous index entries when updating the same tile mesh", () => {
    const tileMesh = createTileMesh("tile-1");

    updateTextureFragmentIndex(tileMesh, ["frag-a", "frag-b"]);
    updateTextureFragmentIndex(tileMesh, ["frag-c", null, "frag-b"]);

    expect(getTextureFragmentSlots("frag-a")).toBeUndefined();
    expect(getSlotIndexes("frag-b", tileMesh)).toEqual([2]);
    expect(getSlotIndexes("frag-c", tileMesh)).toEqual([0]);

    removeTextureFragmentIndex(tileMesh);
  });

  it("removes all slots for a tile mesh", () => {
    const tileMesh = createTileMesh("tile-1");

    updateTextureFragmentIndex(tileMesh, ["frag-a", "frag-b"]);
    removeTextureFragmentIndex(tileMesh);

    expect(getTextureFragmentSlots("frag-a")).toBeUndefined();
    expect(getTextureFragmentSlots("frag-b")).toBeUndefined();
  });

  it("does nothing when removing a tile mesh that is not indexed", () => {
    const tileMesh = createTileMesh("tile-1");

    expect(() => removeTextureFragmentIndex(tileMesh)).not.toThrow();
  });

  it("ignores null fragment ids", () => {
    const tileMesh = createTileMesh("tile-1");

    updateTextureFragmentIndex(tileMesh, [null, null, "frag-a", null]);

    expect(getTextureFragmentSlots("frag-a")).toBeDefined();
    expect(getSlotIndexes("frag-a", tileMesh)).toEqual([2]);
    expect(getTextureFragmentSlots("null")).toBeUndefined();

    removeTextureFragmentIndex(tileMesh);
  });

  it("deduplicates fragment ids in the bidirectional index but preserves slot entries", () => {
    const tileMesh = createTileMesh("tile-1");

    updateTextureFragmentIndex(tileMesh, ["frag-a", "frag-a", "frag-b"]);

    expect(getSlotIndexes("frag-a", tileMesh)).toEqual([0, 1]);
    expect(getSlotIndexes("frag-b", tileMesh)).toEqual([2]);

    removeTextureFragmentIndex(tileMesh);

    expect(getTextureFragmentSlots("frag-a")).toBeUndefined();
    expect(getTextureFragmentSlots("frag-b")).toBeUndefined();
  });

  it("returns undefined for unknown fragment ids", () => {
    expect(getTextureFragmentSlots("not-exists")).toBeUndefined();
  });
});
