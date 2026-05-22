import { describe, it, expect, beforeEach } from "vitest";

import type { TileMesh } from "../mesh/tile";

import {
  updateTextureFragmentIndex,
  removeTextureFragmentIndex,
  getTextureFragmentSlots,
  type TextureSlot,
} from "./textureFragmentIndex";

function createTileMesh(id: string): TileMesh {
  return { id } as unknown as TileMesh;
}

describe("textureFragmentIndex", () => {
  let textureFragmentIndex: Map<string, Set<TextureSlot>>;
  let tileMeshToFragmentIds: Map<TileMesh, Set<string>>;

  beforeEach(() => {
    textureFragmentIndex = new Map<string, Set<TextureSlot>>();
    tileMeshToFragmentIds = new Map<TileMesh, Set<string>>();
  });

  function getSlotIndexes(fragmentId: string, tileMesh: TileMesh): number[] {
    const slots = getTextureFragmentSlots(textureFragmentIndex, fragmentId);
    if (!slots) return [];

    return [...slots]
      .filter((slot) => slot.tileMesh === tileMesh)
      .map((slot) => slot.slotIndex)
      .sort((a, b) => a - b);
  }

  it("indexes texture fragments for a tile mesh", () => {
    const tileMesh = createTileMesh("tile-1");

    updateTextureFragmentIndex(
      textureFragmentIndex,
      tileMeshToFragmentIds,
      tileMesh,
      ["frag-a", null, "frag-b"],
    );

    const fragASlots = getTextureFragmentSlots(textureFragmentIndex, "frag-a");
    const fragBSlots = getTextureFragmentSlots(textureFragmentIndex, "frag-b");
    const fragCSlots = getTextureFragmentSlots(textureFragmentIndex, "frag-c");

    expect(fragASlots).toBeDefined();
    expect(fragBSlots).toBeDefined();
    expect(fragCSlots).toBeUndefined();

    expect(getSlotIndexes("frag-a", tileMesh)).toEqual([0]);
    expect(getSlotIndexes("frag-b", tileMesh)).toEqual([2]);

    removeTextureFragmentIndex(
      textureFragmentIndex,
      tileMeshToFragmentIds,
      tileMesh,
    );
  });

  it("supports multiple tile meshes using the same fragment", () => {
    const tileMesh1 = createTileMesh("tile-1");
    const tileMesh2 = createTileMesh("tile-2");

    updateTextureFragmentIndex(
      textureFragmentIndex,
      tileMeshToFragmentIds,
      tileMesh1,
      ["frag-shared"],
    );
    updateTextureFragmentIndex(
      textureFragmentIndex,
      tileMeshToFragmentIds,
      tileMesh2,
      ["frag-shared", "frag-x"],
    );

    const sharedSlots = getTextureFragmentSlots(
      textureFragmentIndex,
      "frag-shared",
    );
    expect(sharedSlots).toBeDefined();
    expect(sharedSlots && [...sharedSlots].length).toBe(2);

    expect(getSlotIndexes("frag-shared", tileMesh1)).toEqual([0]);
    expect(getSlotIndexes("frag-shared", tileMesh2)).toEqual([0]);
    expect(getSlotIndexes("frag-x", tileMesh2)).toEqual([1]);

    removeTextureFragmentIndex(
      textureFragmentIndex,
      tileMeshToFragmentIds,
      tileMesh1,
    );
    removeTextureFragmentIndex(
      textureFragmentIndex,
      tileMeshToFragmentIds,
      tileMesh2,
    );
  });

  it("removes previous index entries when updating the same tile mesh", () => {
    const tileMesh = createTileMesh("tile-1");

    updateTextureFragmentIndex(
      textureFragmentIndex,
      tileMeshToFragmentIds,
      tileMesh,
      ["frag-a", "frag-b"],
    );
    updateTextureFragmentIndex(
      textureFragmentIndex,
      tileMeshToFragmentIds,
      tileMesh,
      ["frag-c", null, "frag-b"],
    );

    expect(
      getTextureFragmentSlots(textureFragmentIndex, "frag-a"),
    ).toBeUndefined();
    expect(getSlotIndexes("frag-b", tileMesh)).toEqual([2]);
    expect(getSlotIndexes("frag-c", tileMesh)).toEqual([0]);

    removeTextureFragmentIndex(
      textureFragmentIndex,
      tileMeshToFragmentIds,
      tileMesh,
    );
  });

  it("removes all slots for a tile mesh", () => {
    const tileMesh = createTileMesh("tile-1");

    updateTextureFragmentIndex(
      textureFragmentIndex,
      tileMeshToFragmentIds,
      tileMesh,
      ["frag-a", "frag-b"],
    );
    removeTextureFragmentIndex(
      textureFragmentIndex,
      tileMeshToFragmentIds,
      tileMesh,
    );

    expect(
      getTextureFragmentSlots(textureFragmentIndex, "frag-a"),
    ).toBeUndefined();
    expect(
      getTextureFragmentSlots(textureFragmentIndex, "frag-b"),
    ).toBeUndefined();
  });

  it("does nothing when removing a tile mesh that is not indexed", () => {
    const tileMesh = createTileMesh("tile-1");

    expect(() =>
      removeTextureFragmentIndex(
        textureFragmentIndex,
        tileMeshToFragmentIds,
        tileMesh,
      ),
    ).not.toThrow();
  });

  it("ignores null fragment ids", () => {
    const tileMesh = createTileMesh("tile-1");

    updateTextureFragmentIndex(
      textureFragmentIndex,
      tileMeshToFragmentIds,
      tileMesh,
      [null, null, "frag-a", null],
    );

    expect(
      getTextureFragmentSlots(textureFragmentIndex, "frag-a"),
    ).toBeDefined();
    expect(getSlotIndexes("frag-a", tileMesh)).toEqual([2]);
    expect(
      getTextureFragmentSlots(textureFragmentIndex, "null"),
    ).toBeUndefined();

    removeTextureFragmentIndex(
      textureFragmentIndex,
      tileMeshToFragmentIds,
      tileMesh,
    );
  });

  it("deduplicates fragment ids in the bidirectional index but preserves slot entries", () => {
    const tileMesh = createTileMesh("tile-1");

    updateTextureFragmentIndex(
      textureFragmentIndex,
      tileMeshToFragmentIds,
      tileMesh,
      ["frag-a", "frag-a", "frag-b"],
    );

    expect(getSlotIndexes("frag-a", tileMesh)).toEqual([0, 1]);
    expect(getSlotIndexes("frag-b", tileMesh)).toEqual([2]);

    removeTextureFragmentIndex(
      textureFragmentIndex,
      tileMeshToFragmentIds,
      tileMesh,
    );

    expect(
      getTextureFragmentSlots(textureFragmentIndex, "frag-a"),
    ).toBeUndefined();
    expect(
      getTextureFragmentSlots(textureFragmentIndex, "frag-b"),
    ).toBeUndefined();
  });

  it("returns undefined for unknown fragment ids", () => {
    expect(
      getTextureFragmentSlots(textureFragmentIndex, "not-exists"),
    ).toBeUndefined();
  });
});
