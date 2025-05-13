import { tileCoordinatesAsString } from "@navara/core";
import type { TileCoordinates } from "navara_wasm";
import { OrthographicCamera, Scene, WebGLRenderer, type Mesh } from "three";

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

export class TexturizedSceneByTileCoordinates {
  map = new Map<string, Scene>();
  renderer: WebGLRenderer;
  camera: OrthographicCamera;

  constructor(renderer: WebGLRenderer) {
    this.renderer = renderer;
    this.camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.camera.position.z = 1;
  }

  get(coords: TileCoordinates, needsUpdate?: boolean) {
    const key = tileCoordinatesAsString(coords);
    let scene = this.map.get(key);
    if (!scene) {
      scene = new Scene();
      this.map.set(key, scene);
    }
    if (needsUpdate) {
      scene.userData.needsUpdate = true;
    }
    scene.userData.removed = false;
    return scene;
  }

  requestUpdate(coords: TileCoordinates) {
    this.get(coords, true);
  }

  add(coords: TileCoordinates, mesh: Mesh) {
    this.get(coords, true).add(mesh);
  }

  remove(coords: TileCoordinates) {
    const key = tileCoordinatesAsString(coords);
    const scene = this.map.get(key);
    if (scene) {
      scene.userData.removed = true;
    }
  }
}
