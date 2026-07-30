import ThreeView, {
  Color,
  TERRARIUM_ELEVATION_DECODER,
} from "@navaramap/three";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";

import { initializeExample } from "../../../../helpers/initialize";

const view = new ThreeView<DefaultDescriptions>();

const defaultPlugin = new DefaultPlugin();
view.addPlugin(defaultPlugin);

await view.init();

view.atmosphere.date = new Date("2026-07-16T16:30:00Z");
view.addLight({ ambient: { intensity: 0.6 } });
view.addLight({ sun: { intensity: 1.8 } });
view.globe.color = new Color().setStyle("#f2f0ec");

view.setCamera({
  lng: 7.66,
  lat: 45.98,
  height: 70_000,
  heading: 0,
  pitch: -90,
  roll: 0,
});

const dem = view.addSource({
  type: "raster-dem",
  url: "https://terrain.reearth.land/terrarium/elevation/{z}/{x}/{y}.png",
  elevationDecoder: TERRARIUM_ELEVATION_DECODER(),
  tileSize: 512,
  maxZoom: 15,
  minZoom: 5,
});
view.addLayer({
  type: "raster",
  source: dem,
  hillshade: { exaggeration: 1 },
});

view.attribution?.add([
  {
    attribution: "© Re:Earth Terrain",
    attributionUrl: "https://terrain.reearth.land/",
  },
  {
    attribution: "© Mapterhorn",
    attributionUrl: "https://mapterhorn.com/attribution",
  },
]);

initializeExample(view);
