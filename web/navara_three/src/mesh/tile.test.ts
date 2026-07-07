import { Mesh, BoxGeometry, MeshBasicMaterial } from "three";
import { describe, expect, it, vi } from "vitest";

import { TexturizedSceneByTileCoordinates } from "../scene";

import { TileMesh } from "./tile";

// The package barrel pulled in by tile.ts initializes a worker pool at module
// load (os.cpus()), which is unavailable in the test environment. Stub it.
vi.mock("@navara/worker", () => ({
  initializeWorkerPool: vi.fn(),
  terminateWorkerPool: vi.fn(),
}));

function createMockRenderer() {
  return {
    getContext: vi.fn(),
    getPixelRatio: vi.fn().mockReturnValue(1),
    getSize: vi.fn(),
    setSize: vi.fn(),
    render: vi.fn(),
  } as unknown as ConstructorParameters<
    typeof TexturizedSceneByTileCoordinates
  >[0];
}

function drapedMesh(): Mesh {
  return new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
}

/** One Rust-resolved vector-tile state (identity WebMercator drape). */
function state(layerId: string, tileHandle: bigint) {
  return {
    layer_id: layerId,
    tile_handle: tileHandle,
    uv_offset: new Float32Array([0, 0]),
    uv_scale: new Float32Array([1, 1]),
    reproject_terrain_lat: new Float32Array([]),
  };
}

function makeTile() {
  const texturizedScenes = new TexturizedSceneByTileCoordinates(
    createMockRenderer(),
  );
  const renderVectorScenes = vi.fn();
  const markDirty = vi.fn();
  const compositor = {
    acquire: vi.fn(),
    renderVectorScenes,
    markDirty,
    // Keep the MRT composite pass out of this test: it runs only when dirty,
    // and _onBeforeRender returns right after the vector bake when it isn't.
    cache: { isDirty: vi.fn().mockReturnValue(false) },
  };
  const getVectorTileStates = vi.fn().mockReturnValue([]);

  // The vector resolve revision the WASM side exposes: it changes only when the
  // resolved slot set could have changed (a traverse ran / a scene became ready). The
  // tile re-fetches its slots only when this differs from the last frame, so tests that
  // change `getVectorTileStates` must bump it too (as a real traverse would).
  let vectorRevision = 0;
  const bumpRevision = () => {
    vectorRevision += 1;
  };

  const ctx = {
    texturizedSceneByTileCoordinates: texturizedScenes,
    tileTextureCompositor: compositor,
    textureOptions: { maxTextures: 4, additionalTexturesInUse: {} },
    tileMapByHandle: new Map(),
    tileHandler: {
      getVectorTileStates,
      vectorRevision: () => vectorRevision,
      getTile: vi.fn().mockReturnValue({ coords: { x: 0, y: 0, z: 0 } }),
    },
  } as unknown as ConstructorParameters<typeof TileMesh>[0];

  const meshAdded = {
    tile_handle: 1n,
  } as unknown as ConstructorParameters<typeof TileMesh>[1];

  const tile = new TileMesh(ctx, meshAdded);

  return {
    tile,
    texturizedScenes,
    renderVectorScenes,
    getVectorTileStates,
    bumpRevision,
  };
}

/** Invoke the private onBeforeRender hook (args are ignored by the impl). */
function frame(tile: TileMesh) {
  (tile as unknown as { _onBeforeRender: () => void })._onBeforeRender();
}

describe("TileMesh vector bake dirty-gating", () => {
  it("bakes on the first frame, then skips frames with no change", () => {
    const { tile, texturizedScenes, renderVectorScenes, getVectorTileStates } =
      makeTile();

    // One clamp-to-ground layer resolved onto this terrain tile, backed by a
    // populated WM vector scene (handle 1n).
    getVectorTileStates.mockReturnValue([state("a", 1n)]);
    texturizedScenes.add(1n, "a", drapedMesh(), 0);

    frame(tile);
    expect(renderVectorScenes).toHaveBeenCalledTimes(1);

    // Nothing changed → signature stable → no re-bake.
    frame(tile);
    frame(tile);
    expect(renderVectorScenes).toHaveBeenCalledTimes(1);
  });

  it("re-bakes when the backing scene's revision changes", () => {
    const { tile, texturizedScenes, renderVectorScenes, getVectorTileStates } =
      makeTile();

    getVectorTileStates.mockReturnValue([state("a", 1n)]);
    texturizedScenes.add(1n, "a", drapedMesh(), 0);

    frame(tile);
    expect(renderVectorScenes).toHaveBeenCalledTimes(1);

    // The backing scene's content changed (e.g. material/visibility) bumps the scene's
    // revision. This is caught by the bake signature independently of the Rust resolve
    // revision (which is unchanged here, so the slots are not re-fetched).
    texturizedScenes.markDirty(1n, "a");
    frame(tile);
    expect(renderVectorScenes).toHaveBeenCalledTimes(2);

    // Stable again.
    frame(tile);
    expect(renderVectorScenes).toHaveBeenCalledTimes(2);
  });

  it("re-bakes when the resolved slot set changes", () => {
    const {
      tile,
      texturizedScenes,
      renderVectorScenes,
      getVectorTileStates,
      bumpRevision,
    } = makeTile();

    getVectorTileStates.mockReturnValue([state("a", 1n)]);
    texturizedScenes.add(1n, "a", drapedMesh(), 0);

    frame(tile);
    expect(renderVectorScenes).toHaveBeenCalledTimes(1);

    // A second layer becomes resolved → slot set grows. The new resolution comes from a
    // traverse, which bumps the revision; that's what makes the tile re-fetch its slots.
    texturizedScenes.add(2n, "b", drapedMesh(), 1);
    getVectorTileStates.mockReturnValue([state("a", 1n), state("b", 2n)]);
    bumpRevision();
    frame(tile);
    expect(renderVectorScenes).toHaveBeenCalledTimes(2);
  });

  it("does not let a non-draped layer steal a slot from a draped one", () => {
    const {
      tile,
      texturizedScenes,
      renderVectorScenes,
      getVectorTileStates,
      bumpRevision,
    } = makeTile();

    // maxTextures 4 → numTexturizedVector 2. Rust returns THREE layers with a rendered
    // tile, but only "a" and "c" are actually draped (have a texturized scene). "b" is a
    // non-draped MVT layer rendered in the MRT scene; it must not occupy a bake slot and
    // push "c" past the cap.
    texturizedScenes.add(1n, "a", drapedMesh(), 0);
    texturizedScenes.add(3n, "c", drapedMesh(), 2);
    getVectorTileStates.mockReturnValue([
      state("a", 1n),
      state("b", 2n),
      state("c", 3n),
    ]);
    bumpRevision();

    frame(tile);

    const slots = (tile as unknown as { vectorSlots: { layerId: string }[] })
      .vectorSlots;
    expect(slots.map((s) => s.layerId).sort()).toEqual(["a", "c"]);
    expect(renderVectorScenes).toHaveBeenCalledTimes(1);
  });

  it("skips the per-tile resolve fetch while the revision is unchanged", () => {
    const { tile, texturizedScenes, getVectorTileStates } = makeTile();

    getVectorTileStates.mockReturnValue([state("a", 1n)]);
    texturizedScenes.add(1n, "a", drapedMesh(), 0);

    frame(tile);
    expect(getVectorTileStates).toHaveBeenCalledTimes(1);

    // No revision change → the WASM-boundary resolve is not called again, even though
    // its mock would now return a different set. This is the per-frame cost we removed.
    getVectorTileStates.mockReturnValue([state("a", 1n), state("b", 2n)]);
    frame(tile);
    frame(tile);
    expect(getVectorTileStates).toHaveBeenCalledTimes(1);
  });
});
