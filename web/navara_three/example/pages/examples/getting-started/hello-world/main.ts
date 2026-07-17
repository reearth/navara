import ThreeView from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";
import { TileJsonPlugin } from "@navara/three_plugins";

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

// Layer

const imagery = await tilejson.addSource({
  type: "raster-tile",
  url: "https://papers.reearth.land/bluemarble/tilejson.json",
});
view.addLayer({ type: "raster", source: imagery });
