import type { TileHandle } from "@navara/core";
import { OrthographicCamera, Scene, WebGLRenderer, Mesh, Group } from "three";

import type { BatchedFeatureMesh } from "./mesh";

export type Scenes = {
  // Render world that includes user setting object like light
  world: Scene;
  // Render general mesh that doesn't need to handle special case.
  main: Scene;
  // Render only globe.
  globe: Scene;
  // Render only globe for G-Buffer.
  globeGBuffer: Scene;
  // Render only draped features
  drapedFeatures: Scene;
};

export class SceneGroup extends Group {}

export class TexturizedSceneByTileCoordinates {
  map = new Map<TileHandle, SceneGroup>();
  renderer: WebGLRenderer;
  camera: OrthographicCamera;

  constructor(renderer: WebGLRenderer) {
    this.renderer = renderer;
    this.camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.camera.position.z = 1;
  }

  get(handle: TileHandle) {
    let scene = this.map.get(handle);
    if (!scene) {
      scene = new SceneGroup();
      this.map.set(handle, scene);
    }
    return scene;
  }

  add(handle: TileHandle, layerId: string, mesh: Mesh, fromParent = false) {
    const scenes = this.get(handle);
    let scene = scenes.children.find((o) => o.userData.layerId === layerId);
    if (!scene) {
      scene = new Scene();
      scene.userData.layerId = layerId;
      scenes.add(scene);
    }
    if (scene.children.length && fromParent) {
      const idx = scene.children.findIndex((o) => o.userData.fromParent);
      if (idx >= 0) {
        scene.children.splice(idx, 1);
      }
    }

    scene.userData.removed = false;

    scene.add(mesh);

    return scene;
  }

  addFromParentScene(handle: TileHandle, layerId: string, parentScene: Scene) {
    for (const child of parentScene.children) {
      if (child.userData.fromParent) continue;

      const m = child as BatchedFeatureMesh;
      const nm = new Mesh(m.geometry, m.material);
      // Mark this mesh as inherited from the parent.
      nm.userData.fromParent = true;
      this.add(handle, layerId, nm, true);
    }
  }

  showMeshFromParent(
    handle: TileHandle,
    layerId: string,
    enabledParent: boolean,
  ) {
    const scene = this.map
      .get(handle)
      ?.children.find((m) => m.userData.layerId === layerId) as
      | Scene
      | undefined;
    if (!scene) return;
    for (const child of scene.children) {
      if (!child.userData.fromParent) {
        // This mesh should be displayed if the parent tile is disabled.
        // This mesh might be hidden by original mesh process(`event/feature.ts`), but this tile need to show this mesh.
        // This forces to set `visible` according to the raster tile state.
        child.visible = !enabledParent;
        continue;
      }
      child.visible = enabledParent;
    }
  }

  // Find a mesh that isn's marked as inherited from the parent.
  hasCurrentMesh(handle: TileHandle, layerId: string) {
    const scene = this.map
      .get(handle)
      ?.children.find((m) => m.userData.layerId === layerId) as
      | Scene
      | undefined;
    if (!scene) return;
    return scene.children.find((o) => !o.userData.fromParent);
  }

  findSceneByLayerId(handle: TileHandle, layerId: string) {
    const scene = this.map
      .get(handle)
      ?.children.find((m) => m.userData.layerId === layerId) as
      | Scene
      | undefined;

    if (!scene) return;

    return scene;
  }

  remove(handle: TileHandle, layerId: string) {
    const scene = this.map
      .get(handle)
      ?.children.find((c) => c.userData.layerId === layerId);
    if (!scene) return;
    scene.userData.removed = true;
    scene.remove(...scene.children);
  }
}
