import { tileCoordinatesAsString } from "@navara/core";
import type { TileCoordinates } from "navara_wasm";
import { Scene, WebGLRenderer, type Mesh } from "three";

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

  constructor(renderer: WebGLRenderer) {
    this.renderer = renderer;
  }

  get(coords: TileCoordinates) {
    const key = tileCoordinatesAsString(coords);
    let scene = this.map.get(key);
    if (!scene) {
      scene = new Scene();
      this.map.set(key, scene);
    }
    scene.userData.needsUpdate = true;
    return scene;
  }

  requestUpdate(coords: TileCoordinates) {
    this.get(coords);
  }

  add(coords: TileCoordinates, mesh: Mesh) {
    this.get(coords).add(mesh);
  }

  remove(coords: TileCoordinates) {
    const key = tileCoordinatesAsString(coords);
    this.map.delete(key);
  }
}
