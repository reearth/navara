import { AmbientLight, AxesHelper, DirectionalLight } from "three";

import ThreeView from "./lib";

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
if (!canvas) throw new Error("canvas element not found");

const view = new ThreeView({
  canvas,
  debug: true,
});

const axesHelper = new AxesHelper(5);
axesHelper.scale.multiplyScalar(1e9);
view.scene.add(axesHelper);

const ambientLight = new AmbientLight(0xffffff, 0.2);
view.scene.add(ambientLight);

const directionalLight = new DirectionalLight(0xffffff);
directionalLight.position.set(1, 1, 1);
view.scene.add(directionalLight);

const c3tilesUrl =
  "https://plateau.geospatial.jp/main/data/3d-tiles/bldg/13100_tokyo/13101_chiyoda-ku/notexture/tileset.json";
view.addLayer({
  type: "3dtiles",
  url: c3tilesUrl,
});

await view.init();

const tileUrl = "https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png";
const terrainUrl = "https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png";

const chiyodaExtent = {
  west: 139.712,
  south: 35.6544,
  north: 35.71,
  east: 139.782,
};

const fujiExtent = {
  west: 138.558,
  south: 35.244,
  north: 35.496,
  east: 138.866,
};

view.addLayer({
  type: "tiles",
  color: 0xffffff,
  segments: 10,
  height: 0,
  tile_url: tileUrl,
  z: 4,
  wireframe: false,
});

// chiyoda-ku
view.addLayer({
  type: "tiles",
  color: 0xffffff,
  segments: 10,
  height: 36.6,
  tile_url: tileUrl,
  z: 12,
  wireframe: false,
  extent: chiyodaExtent,
});

// fuji
view.addLayer({
  type: "tiles",
  color: 0xffffff,
  segments: 256,
  height: 42.0698,
  tile_url: tileUrl,
  z: 10,
  wireframe: false,
  extent: fujiExtent,
  terrain_url: terrainUrl,
});
