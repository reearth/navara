import ThreeView, {
  Color,
  TERRARIUM_ELEVATION_DECODER,
} from "@navaramap/three";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";

import { initializeExample } from "../../../../helpers/initialize";

const view = new ThreeView<DefaultDescriptions>({
  backgroundColor: new Color().setStyle("#cccccc"),
});

const defaultPlugin = new DefaultPlugin();
view.addPlugin(defaultPlugin);

await view.init();

view.atmosphere.date = new Date("2026-07-16T15:00:00Z");
view.addLight({ ambient: { intensity: 1.0 } });
view.addLight({ sun: { intensity: 3.0, applyColor: true } });

view.setCamera({
  lng: 7.6586,
  lat: 45.9763,
  height: 3500,
  distance: 5000,
  heading: 240,
  pitch: -20,
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
  type: "terrain",
  source: dem,
});

view.addLayer({
  type: "raster",
  source: dem,
  hillshade: { exaggeration: 0.5 },
});

view.attribution?.add([
  {
    attribution: "Re:Earth Terrain",
    attributionUrl: "https://terrain.reearth.land/",
  },
  {
    attribution: "© Mapterhorn",
    attributionUrl: "https://mapterhorn.com/attribution",
  },
]);

initializeExample(view);
