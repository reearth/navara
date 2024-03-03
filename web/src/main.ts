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
