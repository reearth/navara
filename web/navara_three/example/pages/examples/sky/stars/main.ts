import ThreeView from "@navaramap/three";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";

import { initializeExample } from "../../../../helpers/initialize";
import { GOOGLE_MAPS_API_KEY } from "../../../../helpers/keys";

const view = new ThreeView<DefaultDescriptions>({ animation: true });

const defaultPlugin = new DefaultPlugin();
view.addPlugin(defaultPlugin);

await view.init();

const scene = defaultPlugin.addDefaultPhotorealScene();
scene.aerialPerspective.update({
  aerialPerspective: { irradiance: true },
});
view.toneMappingExposure = 40;

view.setCamera({
  lng: -73.978,
  lat: 40.755,
  height: 90,
  heading: 257,
  pitch: -2,
  distance: 2500,
  roll: 0,
});
view.camera.fov = 70;

const tilesSource = view.addSource({
  type: "3d-tiles",
  url: `https://tile.googleapis.com/v1/3dtiles/root.json?key=${encodeURIComponent(
    GOOGLE_MAPS_API_KEY,
  )}`,
});
const tiles = view.addLayer({
  type: "3d-tiles",
  source: tilesSource,
  model: { maxSse: 20, normals: true },
});

view.atmosphere.date = new Date("2025-01-07T03:00:00Z");
scene.stars.update({ stars: { intensity: 100, pointSize: 1.1 } });
scene.sky.update({ sky: { moon: true, moonIntensity: 3, moonScale: 3 } });

view.attribution?.add([
  {
    attribution: "Google Maps Photorealistic 3D Tiles",
    attributionUrl: "https://www.google.com/permissions/geoguidelines/",
    logo: "/credits/GoogleMaps.png",
    creditLayerId: tiles.id,
  },
]);

initializeExample(view);
