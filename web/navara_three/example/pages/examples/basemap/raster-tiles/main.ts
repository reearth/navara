import ThreeView from "@navaramap/three";
import { TileJsonPlugin } from "@navaramap/three-plugins";

import { initializeExample } from "../../../../helpers/initialize";

const view = new ThreeView();

const tilejson = new TileJsonPlugin();
view.addPlugin(tilejson);

await view.init();

view.setCamera({
  lng: 20,
  lat: 10,
  height: 8_000_000,
  heading: 0,
  pitch: -90,
  roll: 0,
});

const basemap = await tilejson.addSource({
  type: "raster-tile",
  url: "https://papers.reearth.land/bluemarble/tilejson.json",
});
view.addLayer({ type: "raster", source: basemap });

initializeExample(view);
