import type { TileHandle } from "@navara/core";
import { OrthographicCamera, Scene, WebGLRenderer, Mesh, Group } from "three";

import type { BatchedFeatureMesh } from "./mesh";

export type Scenes = {
  // Render light in all scenes.
  light: Group;
  // Render general mesh to MRT. The mesh added to this scene needs a normal buffer.
  mrt: Scene;
  // Render only globe.
  globe: Scene;
  // Render only draped mesh on the globe
  draped: Scene;
  // Render this scene at last. This scene should not be handled in MRT.
  opaque: Scene;
  // Render this scene after the atmosphere effect. This scene should not be handled in MRT.
  // It is useful to render a transparent mesh.
  transparent: Scene;
  // Render sky environment map to a cube map for reflections
  skyEnvMap: Scene;
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

  add(
    handle: TileHandle,
    layerId: string,
    mesh: Mesh,
    layerIndex: number,
    fromParent = false,
  ) {
    const scenes = this.get(handle);
    let scene = scenes.children.find((o) => o.userData.layerId === layerId);
    if (!scene) {
      scene = new Scene();
      scene.userData.layerId = layerId;
      scene.userData.layerIndex = layerIndex;
      scenes.add(scene);
      scenes.children.sort(
        (a, b) => a.userData.layerIndex - b.userData.layerIndex,
      );
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
    const layerIndex = parentScene.userData.layerIndex as number;
    for (const child of parentScene.children) {
      if (child.userData.fromParent) continue;

      const m = child as BatchedFeatureMesh;
      const nm = m.clone();
      // Mark this mesh as inherited from the parent.
      nm.userData.fromParent = true;
      this.add(handle, layerId, nm, layerIndex, true);
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

    scene.clear();
  }

  delete(handle: TileHandle) {
    const sceneGroup = this.map.get(handle);
    if (!sceneGroup) return;

    sceneGroup.clear();

    this.map.delete(handle);
  }

  getNeedsUpdate(handle: TileHandle) {
    const scene = this.map.get(handle);
    if (!scene) return false;
    return !!scene.userData.needsUpdate;
  }

  setNeedsUpdate(handle: TileHandle, v: boolean) {
    const scene = this.map.get(handle);
    if (!scene) return;
    scene.userData.needsUpdate = v;
  }
}
