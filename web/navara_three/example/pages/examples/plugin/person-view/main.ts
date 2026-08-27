import ThreeView, { Color } from "@navaramap/three";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";
import { PersonViewPlugin, TileJsonPlugin } from "@navaramap/three-plugins";

import { initializeExample } from "../../../../helpers/initialize";

import { createControlsHelp } from "./controls";

const START = {
  lng: 137.64724,
  lat: 36.25439,
  height: 1600,
  heading: 64.8,
  cameraDistance: 20,
  cameraPitch: 14.4,
};

const view = new ThreeView<DefaultDescriptions>({
  shadow: true,
  backgroundColor: new Color().setStyle("#cccccc"),
});

const defaultPlugin = new DefaultPlugin();
view.addPlugin(defaultPlugin);
const tilejson = new TileJsonPlugin();
view.addPlugin(tilejson);

const personView = new PersonViewPlugin({
  character: {
    modelUrl: "/glTF/Fox/Fox.glb",
    animation: {
      idleClip: "Survey",
      walkClip: "Walk",
      dashClip: "Run",
      dashSpeed: 2,
      crossfadeDuration: 0.3,
    },
    modelRotationOffset: { x: Math.PI / 2, y: Math.PI, z: 0 },
    modelScale: 0.06,
    castShadow: true,
    receiveShadow: true,
  },
  collision: {
    mode: "ground",
  },
  moveSpeed: 10,
  dashSpeedMultiplier: 4,
  cameraDistance: START.cameraDistance,
  cameraPitch: START.cameraPitch,
  fpvHeightOffset: 1.2,
  fpvPitch: 2.9,
  initialView: "tpv",
  startLng: START.lng,
  startLat: START.lat,
  startHeading: START.heading,
});
view.addPlugin(personView);

await view.init();

// Preload terrain
view.setCamera({
  lng: START.lng,
  lat: START.lat,
  height: START.height,
  distance: START.cameraDistance,
  heading: START.heading,
  pitch: START.cameraPitch,
  roll: 0,
});

view.atmosphere.date = new Date("2026-08-03T00:30:00Z");
view.addLight({ ambient: { intensity: 1 } });
view.addLight({
  sun: {
    intensity: 2,
    castShadow: true,
    applyColor: true,
    shadowFar: 1000,
    shadowLambda: 1,
  },
});

const terrain = view.addSource({
  type: "quantized-mesh",
  url: "https://terrain.reearth.land/cesium-mesh/ellipsoid/{z}/{x}/{y}.terrain",
  maxZoom: 18,
  minZoom: 2,
  requestVertexNormals: true,
});
view.addLayer({
  type: "terrain",
  source: terrain,
  terrain: { castShadow: true, receiveShadow: true },
});

const basemap = await tilejson.addSource({
  type: "raster-tile",
  url: "https://papers.reearth.land/styles/papers-light/tilejson.json",
});
view.addLayer({ type: "raster", source: basemap });

const controlsHelp = createControlsHelp();
personView.onAction(() => controlsHelp.hide());

view.attribution?.add([
  {
    attribution: "Re:Earth Terrain",
    attributionUrl: "https://terrain.reearth.land/",
  },
  {
    attribution:
      "Fox by PixelMannen (CC0), rig & animation by tomkranis (CC BY 4.0) — Khronos glTF Sample Assets",
    attributionUrl:
      "https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Fox",
  },
]);

await personView.resolveStartHeight(terrain);

personView.start();

let walking = true;
window.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  walking = !walking;
  if (walking) {
    personView.start();
  } else {
    personView.stop();
  }
  controlsHelp.setReleased(!walking);
});

if (personView.model) {
  initializeExample(view, [personView.model]);
}
