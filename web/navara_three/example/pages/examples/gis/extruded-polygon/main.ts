import ThreeView, { Color } from "@navaramap/three";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three_default_plugin";
import { TileJsonPlugin } from "@navaramap/three_plugins";

import { initializeExample } from "../../../../helpers/initialize";

import { huts } from "./data";

const view = new ThreeView<DefaultDescriptions>();

initializeExample(view);

const defaultPlugin = new DefaultPlugin();
view.addPlugin(defaultPlugin);
const tilejson = new TileJsonPlugin();
view.addPlugin(tilejson);

await view.init();

// Extruded polygons are lit geometry, so give them a fixed sun + ambient fill.
view.atmosphere.date = new Date("2026-07-16T03:00:00Z");
view.addLight({ ambient: { intensity: 0.6 } });
view.addLight({ sun: { intensity: 1.8 } });

// Low oblique view over the lodge block so the extrusion height reads clearly.
view.setCamera({
  lng: 86.82918,
  lat: 27.98082,
  distance: 52,
  heading: 25,
  pitch: -35,
  roll: 0,
});

const basemap = await tilejson.addSource({
  type: "raster-tile",
  url: "https://papers.reearth.land/styles/white/tilejson.json",
});
view.addLayer({ type: "raster", source: basemap });

// `extrudedHeight` raises every footprint into a fixed-height block;
// extrusion needs real geometry, so the polygons are not clamped to ground.
const source = view.addSource({ type: "geojson", data: huts });
view.addLayer({
  type: "vector",
  source,
  polygon: {
    color: new Color().setStyle("#0091ff"),
    extrudedHeight: 5,
    clampToGround: false,
  },
});

view.attribution?.add([
  {
    attribution: "© OpenStreetMap contributors",
    attributionUrl: "https://www.openstreetmap.org/copyright",
  },
]);
