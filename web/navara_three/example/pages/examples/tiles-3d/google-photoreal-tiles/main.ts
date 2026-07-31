import ThreeView from "@navaramap/three";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";

import { initializeExample } from "../../../../helpers/initialize";
import { GOOGLE_MAPS_API_KEY } from "../../../../helpers/keys";

const view = new ThreeView<DefaultDescriptions>();

const defaultPlugin = new DefaultPlugin();
view.addPlugin(defaultPlugin);

await view.init();

defaultPlugin.addDefaultPhotorealScene();
view.toneMappingExposure = 5;
view.atmosphere.date = new Date("2026-07-01T16:30:00Z");

view.setCamera({
  lng: -1.5115,
  lat: 48.636,
  distance: 500,
  heading: 320,
  pitch: -13,
  roll: 0,
});

const tilesSource = view.addSource({
  type: "3d-tiles",
  url: `https://tile.googleapis.com/v1/3dtiles/root.json?key=${encodeURIComponent(
    GOOGLE_MAPS_API_KEY,
  )}`,
});
const tiles = view.addLayer({
  type: "3d-tiles",
  source: tilesSource,
  model: { maxSse: 40 },
});

view.attribution?.add([
  {
    attribution: "Google Maps Photorealistic 3D Tiles",
    attributionUrl: "https://www.google.com/permissions/geoguidelines/",
    logo: "/credits/GoogleMaps.png",
    creditLayerId: tiles.id,
  },
]);

initializeExample(view);
