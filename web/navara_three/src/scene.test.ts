import { Mesh, BoxGeometry, MeshBasicMaterial } from "three";
import { describe, it, expect, vi } from "vitest";

import { TexturizedSceneByTileCoordinates, TileScene } from "./scene";

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

function createMesh(): Mesh {
  return new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
}

function getGroup(ts: TexturizedSceneByTileCoordinates, handle: bigint) {
  const group = ts.map.get(handle);
  if (!group) throw new Error("group not found");
  return group;
}

describe("add", () => {
  it("add creates a new TileScene with layerId inside SceneGroup", () => {
    const ts = new TexturizedSceneByTileCoordinates(createMockRenderer());
    const handle = 1n;
    const mesh = createMesh();

    ts.add(handle, "layer-a", mesh, 0);

    const group = getGroup(ts, handle);
    expect(group.tileScenes).toHaveLength(1);
    expect(group.tileScenes[0].layerId).toBe("layer-a");
    expect(group.tileScenes[0]).toBeInstanceOf(TileScene);
  });

  it("add with same layerId reuses existing Scene", () => {
    const ts = new TexturizedSceneByTileCoordinates(createMockRenderer());
    const handle = 1n;

    ts.add(handle, "layer-a", createMesh(), 0);
    ts.add(handle, "layer-a", createMesh(), 0);

    const group = getGroup(ts, handle);
    expect(group.tileScenes).toHaveLength(1);
    expect(group.tileScenes[0].children).toHaveLength(2);
  });

  it("scenes are sorted by layerIndex", () => {
    const ts = new TexturizedSceneByTileCoordinates(createMockRenderer());
    const handle = 1n;

    ts.add(handle, "c", createMesh(), 2);
    ts.add(handle, "b", createMesh(), 1);
    ts.add(handle, "a", createMesh(), 0);

    const group = getGroup(ts, handle);
    expect(group.tileScenes.map((c) => c.layerIndex)).toEqual([0, 1, 2]);
    expect(group.tileScenes.map((c) => c.layerId)).toEqual(["a", "b", "c"]);
  });

  it("revision increments on add", () => {
    const ts = new TexturizedSceneByTileCoordinates(createMockRenderer());
    const handle = 1n;

    ts.add(handle, "layer-a", createMesh(), 0);
    const scene = ts.findSceneByLayerId(handle, "layer-a");
    expect(scene?.revision).toBe(1);

    ts.add(handle, "layer-a", createMesh(), 0);
    expect(scene?.revision).toBe(2);
  });

  it("remove marks scene as removed, clears children, and increments revision", () => {
    const ts = new TexturizedSceneByTileCoordinates(createMockRenderer());
    const handle = 1n;

    ts.add(handle, "layer-a", createMesh(), 0);
    const scene = ts.findSceneByLayerId(handle, "layer-a");
    const revBefore = scene?.revision;
    ts.remove(handle, "layer-a");

    expect(scene?.removed).toBe(true);
    expect(scene?.children).toHaveLength(0);
    expect(scene?.revision).toBe((revBefore ?? 0) + 1);
  });

  it("delete removes the entire SceneGroup for a tile handle", () => {
    const ts = new TexturizedSceneByTileCoordinates(createMockRenderer());
    const handle = 1n;

    ts.add(handle, "layer-a", createMesh(), 0);
    ts.delete(handle);

    expect(ts.map.has(handle)).toBe(false);
  });
});

describe("showMeshFromParent", () => {
  it("enabledParent=true hides own meshes and shows parent meshes", () => {
    const ts = new TexturizedSceneByTileCoordinates(createMockRenderer());
    const handle = 1n;

    const ownMesh = createMesh();
    ts.add(handle, "layer-a", ownMesh, 0);

    const parentMesh = createMesh();
    parentMesh.userData.fromParent = true;
    ts.add(handle, "layer-a", parentMesh, 0, true);

    ts.showMeshFromParent(handle, "layer-a", true);

    expect(ownMesh.visible).toBe(false);
    expect(parentMesh.visible).toBe(true);

    ts.showMeshFromParent(handle, "layer-a", false);

    expect(ownMesh.visible).toBe(true);
    expect(parentMesh.visible).toBe(false);
  });

  it("no-op when handle/layerId not found", () => {
    const ts = new TexturizedSceneByTileCoordinates(createMockRenderer());

    expect(() =>
      ts.showMeshFromParent(999n, "nonexistent", true),
    ).not.toThrow();
  });
});

describe("hasCurrentMesh", () => {
  it("returns the own mesh when present", () => {
    const ts = new TexturizedSceneByTileCoordinates(createMockRenderer());
    const handle = 1n;

    const ownMesh = createMesh();
    ts.add(handle, "layer-a", ownMesh, 0);

    expect(ts.hasCurrentMesh(handle, "layer-a")).toBeTruthy();
  });

  it("returns undefined when only parent meshes exist", () => {
    const ts = new TexturizedSceneByTileCoordinates(createMockRenderer());
    const handle = 1n;
    const parentHandle = 2n;

    // Add a mesh to the parent
    ts.add(parentHandle, "layer-a", createMesh(), 0);
    const parentScene = ts.findSceneByLayerId(parentHandle, "layer-a");
    if (!parentScene) throw new Error("parent scene not found");

    // Inherit into child via addFromParentScene
    ts.addFromParentScene(handle, "layer-a", parentScene);

    expect(ts.hasCurrentMesh(handle, "layer-a")).toBeUndefined();
  });

  it("returns undefined for unknown handle/layerId", () => {
    const ts = new TexturizedSceneByTileCoordinates(createMockRenderer());

    expect(ts.hasCurrentMesh(999n, "nonexistent")).toBeUndefined();
  });
});

describe("findSceneByLayerId", () => {
  it("returns the TileScene for a known layerId", () => {
    const ts = new TexturizedSceneByTileCoordinates(createMockRenderer());
    const handle = 1n;

    ts.add(handle, "layer-a", createMesh(), 0);

    const scene = ts.findSceneByLayerId(handle, "layer-a");
    expect(scene).toBeInstanceOf(TileScene);
    expect(scene?.layerId).toBe("layer-a");
  });

  it("returns undefined for unknown layerId", () => {
    const ts = new TexturizedSceneByTileCoordinates(createMockRenderer());

    expect(ts.findSceneByLayerId(1n, "nonexistent")).toBeUndefined();
  });
});

describe("getNeedsUpdate / setNeedsUpdate", () => {
  it("defaults to false for a new tile", () => {
    const ts = new TexturizedSceneByTileCoordinates(createMockRenderer());
    const handle = 1n;

    // Create the SceneGroup via get()
    ts.get(handle);

    expect(ts.getNeedsUpdate(handle)).toBe(false);
  });

  it("setNeedsUpdate(true) then getNeedsUpdate returns true", () => {
    const ts = new TexturizedSceneByTileCoordinates(createMockRenderer());
    const handle = 1n;

    ts.get(handle);
    ts.setNeedsUpdate(handle, true);

    expect(ts.getNeedsUpdate(handle)).toBe(true);
  });

  it("setNeedsUpdate(false) clears the flag", () => {
    const ts = new TexturizedSceneByTileCoordinates(createMockRenderer());
    const handle = 1n;

    ts.get(handle);
    ts.setNeedsUpdate(handle, true);
    ts.setNeedsUpdate(handle, false);

    expect(ts.getNeedsUpdate(handle)).toBe(false);
  });
});

describe("addFromParentScene", () => {
  it("inherits layerIndex from parent scene", () => {
    const ts = new TexturizedSceneByTileCoordinates(createMockRenderer());
    const parentHandle = 1n;
    const childHandle = 2n;

    ts.add(parentHandle, "layer-x", createMesh(), 5);
    ts.add(childHandle, "layer-y", createMesh(), 0);

    const parentScene = ts.findSceneByLayerId(parentHandle, "layer-x");
    if (!parentScene) throw new Error("parent scene not found");
    ts.addFromParentScene(childHandle, "layer-x", parentScene);

    const group = getGroup(ts, childHandle);
    expect(group.tileScenes[0].layerIndex).toBe(0);
    expect(group.tileScenes[1].layerIndex).toBe(5);
  });

  it("replaces existing fromParent mesh with new clone", () => {
    const ts = new TexturizedSceneByTileCoordinates(createMockRenderer());
    const parentHandle = 1n;
    const childHandle = 2n;

    // Add a mesh to parent
    ts.add(parentHandle, "layer-a", createMesh(), 0);

    const parentScene = ts.findSceneByLayerId(parentHandle, "layer-a");
    if (!parentScene) throw new Error("parent scene not found");

    // First clone
    ts.addFromParentScene(childHandle, "layer-a", parentScene);
    const childScene = ts.findSceneByLayerId(childHandle, "layer-a");
    expect(
      childScene?.children.filter((c) => c.userData.fromParent),
    ).toHaveLength(1);

    // Re-clone replaces existing fromParent mesh
    ts.addFromParentScene(childHandle, "layer-a", parentScene);
    expect(
      childScene?.children.filter((c) => c.userData.fromParent),
    ).toHaveLength(1);
  });
});

describe("parent fallback flow (integration)", () => {
  it("mimics tile.ts updateTexturizedSceneByTileState + _onBeforeRender", () => {
    const ts = new TexturizedSceneByTileCoordinates(createMockRenderer());
    const parentHandle = 1n;
    const childHandle = 2n;
    const layerId = "buildings";

    // 1. Add a mesh to parent handle's layer
    ts.add(parentHandle, layerId, createMesh(), 0);

    // 2. findSceneByLayerId on parent → addFromParentScene on child
    const parentScene = ts.findSceneByLayerId(parentHandle, layerId);
    if (!parentScene) throw new Error("parent scene not found");
    ts.addFromParentScene(childHandle, layerId, parentScene);

    // 3. hasCurrentMesh on child returns undefined (only parent mesh)
    expect(ts.hasCurrentMesh(childHandle, layerId)).toBeUndefined();

    // 4. showMeshFromParent(child, layerId, true) → parent mesh visible
    ts.showMeshFromParent(childHandle, layerId, true);
    const childScene = ts.findSceneByLayerId(childHandle, layerId);
    if (!childScene) throw new Error("child scene not found");
    for (const child of childScene.children) {
      if (child.userData.fromParent) {
        expect(child.visible).toBe(true);
      }
    }

    // 5. Add an own mesh to child
    const ownMesh = createMesh();
    ts.add(childHandle, layerId, ownMesh, 0);

    // 6. hasCurrentMesh now returns truthy
    expect(ts.hasCurrentMesh(childHandle, layerId)).toBeTruthy();

    // 7. showMeshFromParent(child, layerId, false) → own mesh visible, parent hidden
    ts.showMeshFromParent(childHandle, layerId, false);
    expect(ownMesh.visible).toBe(true);
    for (const child of childScene.children) {
      if (child.userData.fromParent) {
        expect(child.visible).toBe(false);
      }
    }
  });
});
