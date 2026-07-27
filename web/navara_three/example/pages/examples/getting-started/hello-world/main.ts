import ThreeView from "@navaramap/three";
import { DefaultPlugin } from "@navaramap/three_default_plugin";
import { TileJsonPlugin } from "@navaramap/three_plugins";

import { initializeExample } from "../../../../helpers/initialize";

const view = new ThreeView({ useNormal: true });

// Plugin settings

const tilejson = new TileJsonPlugin();
view.addPlugin(tilejson);

const defaultPlugin = new DefaultPlugin();
view.addPlugin(defaultPlugin);

// Initialize

await view.init();

// Set up the default scene

defaultPlugin.addDefaultPhotorealScene();
view.atmosphere.date = new Date("2026-07-16T01:00:00Z");
view.toneMappingExposure = 10;

// Camera

// Close enough that the globe nearly fills the frame.
view.setCamera({
  lng: 140,
  lat: 25,
  height: 8_000_000,
  heading: 0,
  pitch: -90,
  roll: 0,
});

// Layer

const imagery = await tilejson.addSource({
  type: "raster-tile",
  url: "https://papers.reearth.land/bluemarble/tilejson.json",
});
view.addLayer({ type: "raster", source: imagery });

initializeExample(view);
